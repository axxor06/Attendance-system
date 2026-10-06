import asyncHandler from 'express-async-handler';
import { Subject, User, Class } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import {
  getSubjectRoster,
  getOverallAttendance,
  getSubjectWiseAttendance,
} from '../services/attendanceService.js';
import { buildSubjectAttendancePdf, buildStudentAttendancePdf, buildClassMonthlyPdf } from '../services/pdfReportService.js';
import { buildSubjectAttendanceExcel, buildStudentAttendanceExcel, buildClassMonthlyExcel } from '../services/excelReportService.js';
import { Attendance } from '../models/index.js';
import { PRESENT_LIKE_STATUSES, roleValues, ROLES } from '../config/constants.js';
import {
  assertClassAccess,
  assertStudentAccess,
  assertSubjectAccess,
} from '../utils/authorization.js';

const MAX_REPORT_ROWS = Math.min(10000, Math.max(100, Number(process.env.MAX_REPORT_ROWS) || 5000));

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function safeFilename(value, fallback = 'attendance-report') {
  return String(value || fallback).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
}

function normalizeReportFormat(value) {
  const format = String(value || 'pdf').toLowerCase();
  if (!['pdf', 'excel', 'xlsx'].includes(format)) {
    throw ApiError.badRequest('Report format must be pdf or excel.');
  }
  return format === 'xlsx' ? 'excel' : format;
}

/**
 * Subject report (faculty/HOD): every student in the subject with their
 * attended/total/percentage, exported as PDF or Excel based on ?format=.
 */
export const exportSubjectReport = asyncHandler(async (req, res) => {
  const { subjectId } = req.params;
  const { from, to } = req.query;
  const format = normalizeReportFormat(req.query.format);

  const subject = await assertSubjectAccess(req, subjectId, { requireFaculty: true });
  const rows = await getSubjectRoster({ subjectId, from, to });
  if (rows.length > MAX_REPORT_ROWS) {
    throw ApiError.payloadTooLarge(`This report contains too many rows. Narrow the date range or export in smaller periods (maximum ${MAX_REPORT_ROWS} rows).`);
  }
  const generatedAt = new Date();

  if (format === 'excel') {
    const workbook = await buildSubjectAttendanceExcel({
      subjectName: subject.name,
      subjectCode: subject.code,
      className: subject.class?.name,
      rows,
      generatedAt,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(subject.code)}_attendance_report.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  const buffer = await buildSubjectAttendancePdf({
    subjectName: subject.name,
    subjectCode: subject.code,
    className: subject.class?.name,
    rows,
    generatedAt,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(subject.code)}_attendance_report.pdf"`);
  return res.send(buffer);
});

/**
 * Student's own report: subject-wise breakdown, exported as PDF or Excel.
 */
export const exportStudentReport = asyncHandler(async (req, res) => {
  const format = normalizeReportFormat(req.query.format);
  const studentId = req.params.studentId || req.user._id;

  // Non-self lookups (faculty/HOD viewing a specific student) are allowed;
  // students can only export their own report.
  if (req.user.role === ROLES.USER && studentId.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You can only export your own attendance report.');
  }

  const student = await assertStudentAccess(req, studentId);

  const [overall, subjectWise] = await Promise.all([
    getOverallAttendance({ studentId }),
    getSubjectWiseAttendance({ studentId }),
  ]);

  const generatedAt = new Date();

  if (format === 'excel') {
    const workbook = await buildStudentAttendanceExcel({
      studentName: student.name,
      registerNumber: student.registerNumber,
      overall,
      subjectWise,
      generatedAt,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(student.registerNumber || student.name)}_attendance.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  const buffer = await buildStudentAttendancePdf({
    studentName: student.name,
    registerNumber: student.registerNumber,
    overall,
    subjectWise,
    generatedAt,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(student.registerNumber || student.name)}_attendance.pdf"`);
  return res.send(buffer);
});

/**
 * Class-wide monthly report (HOD/faculty/class teacher): every student in
 * the class with their attendance for a given month.
 */
export const exportClassMonthlyReport = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { year, month } = req.query;
  const format = normalizeReportFormat(req.query.format);

  await assertClassAccess(req, classId);
  const classDoc = await Class.findById(classId).populate('department');
  if (!classDoc) throw ApiError.notFound('Class not found');

  const now = new Date();
  const targetYear = year ? Number(year) : now.getUTCFullYear();
  const targetMonth = month ? Number(month) : now.getUTCMonth() + 1; // 1-indexed
  if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2200 || !Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
    throw ApiError.badRequest('A valid year and month are required.');
  }

  const from = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
  const to = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59));

  const studentCount = await User.countDocuments({ class: classId, role: { $in: roleValues(ROLES.USER) } });
  if (studentCount > MAX_REPORT_ROWS) {
    throw ApiError.payloadTooLarge(`This report contains too many students. Narrow the export scope (maximum ${MAX_REPORT_ROWS} rows).`);
  }
  const students = await User.find({ class: classId, role: { $in: roleValues(ROLES.USER) } }).select('name registerNumber').limit(MAX_REPORT_ROWS);

  const agg = await Attendance.aggregate([
    { $match: { class: classDoc._id, date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$student',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0] } },
      },
    },
  ]);
  const byStudent = new Map(agg.map((a) => [a._id.toString(), a]));

  const rows = students
    .map((s) => {
      const a = byStudent.get(s._id.toString());
      const total = a?.total || 0;
      const present = a?.present || 0;
      const percentage = total === 0 ? 0 : Math.round((present / total) * 10000) / 100;
      return { name: s.name, registerNumber: s.registerNumber, total, present, percentage };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const monthLabel = `${MONTH_NAMES[targetMonth - 1]} ${targetYear}`;
  const generatedAt = new Date();

  if (format === 'excel') {
    const workbook = await buildClassMonthlyExcel({ className: classDoc.name, monthLabel, rows, generatedAt });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(`${classDoc.code}_${monthLabel}`)}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  const buffer = await buildClassMonthlyPdf({ className: classDoc.name, monthLabel, rows, generatedAt });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(`${classDoc.code}_${monthLabel}`)}.pdf"`);
  return res.send(buffer);
});
