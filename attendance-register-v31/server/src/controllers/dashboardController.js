import asyncHandler from 'express-async-handler';
import { User, Subject, Attendance, ActivityLog, Class, Department } from '../models/index.js';
import { getClassDaySchedule, getFacultySubjectScope } from '../services/timetableService.js';
import sendResponse from '../utils/sendResponse.js';
import {
  getOverallAttendance,
  getSubjectWiseAttendance,
  getMonthlyAttendance,
  getLowAttendanceStudents,
} from '../services/attendanceService.js';
import { roleValues, ROLES, LOW_ATTENDANCE_THRESHOLD, PRESENT_LIKE_STATUSES } from '../config/constants.js';

function todayRange() {
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(); end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const getHodDashboard = asyncHandler(async (req, res) => {
  const { start, end } = todayRange();
  const since = monthStart();
  const attendanceScope = {};
  const userScope = {};
  const activityActorScope = {};

  const [totalStudents, totalFaculty, totalDepartments, totalClasses] = await Promise.all([
    User.countDocuments({ ...userScope, role: { $in: roleValues(ROLES.USER) }, isActive: true }),
    User.countDocuments({ ...userScope, role: { $in: roleValues(ROLES.ADMIN) }, isActive: true }),
    Department.countDocuments({ isActive: true }),
    Class.countDocuments({ ...attendanceScope, isActive: true }),
  ]);

  const [[todayAgg], [monthAgg], lowAttendanceStudents, recentActivity, trend] = await Promise.all([
    Attendance.aggregate([{ $match: { ...attendanceScope, date: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0] } } } }]),
    Attendance.aggregate([{ $match: { ...attendanceScope, date: { $gte: since } } }, { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0] } } } }]),
    getLowAttendanceStudents({ threshold: LOW_ATTENDANCE_THRESHOLD }),
    ActivityLog.find(activityActorScope).populate('actor', 'name role').sort({ createdAt: -1 }).limit(15),
    Attendance.aggregate([{ $match: { ...attendanceScope, date: { $gte: (() => { const d = new Date(); d.setDate(d.getDate() - 13); d.setUTCHours(0, 0, 0, 0); return d; })() } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0] } } } }, { $project: { _id: 0, date: '$_id', total: 1, present: 1, percentage: { $cond: [{ $eq: ['$total', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 2] }] } } }, { $sort: { date: 1 } }]),
  ]);

  return sendResponse(res, 200, 'HOD dashboard data fetched', {
    totals: { totalStudents, totalFaculty, totalDepartments, totalClasses },
    todayAttendance: { total: todayAgg?.total || 0, present: todayAgg?.present || 0, percentage: todayAgg?.total ? Math.round((todayAgg.present / todayAgg.total) * 10000) / 100 : 0 },
    monthlyAttendance: { total: monthAgg?.total || 0, present: monthAgg?.present || 0, percentage: monthAgg?.total ? Math.round((monthAgg.present / monthAgg.total) * 10000) / 100 : 0 },
    lowAttendanceStudents: lowAttendanceStudents.slice(0, 10),
    lowAttendanceCount: lowAttendanceStudents.length,
    recentActivity,
    attendanceTrend: trend,
  });
});

export const getFacultyDashboard = asyncHandler(async (req, res) => {
  const facultyId = req.user._id;
  const { start, end } = todayRange();
  const facultySubjectScope = await getFacultySubjectScope(facultyId);
  const subjectsFilter = { isActive: true, ...facultySubjectScope };

  const [subjects, recentAttendance, todayMarkedCount] = await Promise.all([
    Subject.find(subjectsFilter)
      .populate('class', 'name code')
      .populate('department', 'name code'),
    Attendance.find({ faculty: facultyId })
      .populate('subject', 'name code')
      .populate('student', 'name registerNumber')
      .sort({ markedAt: -1 })
      .limit(15),
    Attendance.countDocuments({ faculty: facultyId, date: { $gte: start, $lte: end } }),
  ]);

  return sendResponse(res, 200, 'Faculty dashboard data fetched', {
    assignedSubjectsCount: subjects.length,
    subjects,
    todayMarkedCount,
    recentAttendance,
  });
});

export const getStudentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const { start, end } = todayRange();
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const todayName = dayNames[new Date().getDay()];

  const student = await User.findById(studentId).populate('class');

  const [overall, subjectWise, monthly, recent, todayAttendance, schedule] = await Promise.all([
    getOverallAttendance({ studentId }),
    getSubjectWiseAttendance({ studentId }),
    getMonthlyAttendance({ studentId }),
    Attendance.find({ student: studentId }).populate('subject', 'name code').sort({ date: -1, periodOrder: 1 }).limit(15),
    Attendance.find({ student: studentId, date: { $gte: start, $lte: end } }).populate('subject', 'name code').sort({ periodOrder: 1 }),
    student?.class?._id ? getClassDaySchedule(student.class._id, todayName) : Promise.resolve({ slots: [] }),
  ]);

  // Build timetable with today's attendance status per period
  let timetable = [];
  if (schedule?.slots?.length) {
    const attendanceByPeriod = {};
    todayAttendance.forEach(a => { attendanceByPeriod[a.periodOrder] = a.status; });
    timetable = schedule.slots.map(period => ({
      order: period.order,
      name: period.name,
      kind: period.kind,
      startTime: period.startTime || null,
      endTime: period.endTime || null,
      subject: period.subject ? { id: period.subject._id, name: period.subject.name, code: period.subject.code } : null,
      faculty: period.faculty ? { id: period.faculty._id, name: period.faculty.name, employeeId: period.faculty.employeeId } : null,
      attendanceStatus: attendanceByPeriod[period.order] || null,
    }));
  }

  // Attendance prediction
  const { total, present } = overall;
  const prediction = { needed75: 0, needed85: 0 };
  if (total > 0 && overall.percentage < 75) {
    prediction.needed75 = Math.max(0, Math.ceil((0.75 * total - present) / 0.25));
  }
  if (overall.percentage >= 75) {
    prediction.canMiss75 = Math.max(0, Math.floor((present - 0.75 * total) / 0.75));
  }
  if (total > 0 && overall.percentage < 85) {
    prediction.needed85 = Math.max(0, Math.ceil((0.85 * total - present) / 0.15));
  }
  if (overall.percentage >= 85) {
    prediction.canMiss85 = Math.max(0, Math.floor((present - 0.85 * total) / 0.85));
  }

  return sendResponse(res, 200, 'Student dashboard data fetched', {
    overall, subjectWise, monthly,
    recentHistory: recent,
    todayAttendance,
    timetable,
    prediction,
    lowAttendanceWarning: overall.total >= 5 && overall.percentage < LOW_ATTENDANCE_THRESHOLD,
    studentClass: student?.class?.name || null,
    todayDay: todayName,
  });
});
