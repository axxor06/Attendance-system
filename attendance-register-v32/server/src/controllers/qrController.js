import asyncHandler from 'express-async-handler';
import { QrSession, Subject, Attendance, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { PERIOD_KIND, ATTENDANCE_STATUS, canonicalRole, ROLES } from '../config/constants.js';
import { assertSubjectAccess, isSameId } from '../utils/authorization.js';
import { getClassPeriodSlot } from '../services/timetableService.js';

import {
  generateAttendanceCode,
  hashAttendanceCode,
  isValidAttendanceCodeFormat,
  normalizeAttendanceCode,
  qrSessionTtlMinutes,
} from '../utils/attendanceCode.js';

const CODE_GENERATION_ATTEMPTS = 5;

function normalizeToUtcMidnight(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('A valid date is required.');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getDayOfWeekName(date) {
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[new Date(date).getUTCDay()];
}

export const generateQr = asyncHandler(async (req, res) => {
  const { subjectId, date, periodOrder } = req.body;
  const subject = await assertSubjectAccess(req, subjectId, { requireFaculty: true });

  const normalizedDate = normalizeToUtcMidnight(date);
  const dayName = getDayOfWeekName(date);
  const { slot: periodSlot, source } = await getClassPeriodSlot({
    classId: subject.class._id,
    dayOfWeek: dayName,
    periodOrder: Number(periodOrder),
  });
  if (!periodSlot) throw ApiError.badRequest(`Period ${periodOrder} not found in ${dayName}'s class timetable.`);
  if (source === 'class-timetable' && !isSameId(periodSlot.subject, subject._id)) {
    throw ApiError.forbidden('This subject is not scheduled for the selected class period.');
  }
  if (canonicalRole(req.user.role) !== ROLES.SUPER_ADMIN && source === 'class-timetable' && !isSameId(periodSlot.faculty, req.user._id)) {
    throw ApiError.forbidden('You are not assigned to this exact timetable period.');
  }
  if (periodSlot.kind !== PERIOD_KIND.CLASS) throw ApiError.badRequest(`"${periodSlot.name}" is a break period.`);

  await QrSession.updateMany(
    { subject: subject._id, date: normalizedDate, periodOrder: Number(periodOrder), isActive: true },
    { $set: { isActive: false } }
  );

  const ttlMinutes = qrSessionTtlMinutes();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  let session = null;
  let code = null;
  // A collision on the unique digest index (astronomically unlikely) just draws a new code.
  for (let attempt = 0; attempt < CODE_GENERATION_ATTEMPTS && !session; attempt += 1) {
    code = generateAttendanceCode();
    try {
      session = await QrSession.create({
        subject: subject._id,
        class: subject.class._id,
        faculty: req.user._id,
        date: normalizedDate,
        dayOfWeek: dayName,
        periodOrder: Number(periodOrder),
        periodName: periodSlot.name,
        token: hashAttendanceCode(code),
        expiresAt,
        isActive: true,
        scannedStudents: [],
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      if (error.keyPattern?.token) continue;
      throw ApiError.conflict('Another attendance session was generated for this period. Please refresh and try again.');
    }
  }
  if (!session) throw ApiError.internal('An attendance code could not be generated. Please try again.');

  return sendResponse(res, 201, 'Attendance session created', {
    sessionId: session._id,
    // Returned once to the faculty client; only a keyed digest is stored.
    code,
    token: code, // Backward-compatible alias for older clients.
    expiresAt,
    subject: { id: subject._id, name: subject.name, code: subject.code },
    periodName: periodSlot.name,
    expiresInMinutes: ttlMinutes,
  });
});

export const scanQr = asyncHandler(async (req, res) => {
  // `code` is the documented field; `token` remains accepted for older clients.
  const rawCode = req.body.code ?? req.body.token;
  if (typeof rawCode !== 'string' || !rawCode.trim()) throw ApiError.badRequest('Enter the attendance code.');
  const code = normalizeAttendanceCode(rawCode);
  if (!isValidAttendanceCodeFormat(code)) throw ApiError.badRequest('That code is not valid. Attendance codes have 8 letters and numbers.');
  if (canonicalRole(req.user.role) !== ROLES.USER || !req.user.isActive) throw ApiError.forbidden('Only active students can mark attendance with a code.');

  const student = await User.findById(req.user._id).select('role class isActive');
  if (!student?.isActive) throw ApiError.forbidden('Your account is inactive.');
  if (!student.class) throw ApiError.forbidden('Your account is not assigned to a class.');

  // Scoping the lookup to the student's own class means a code can never be
  // matched against (or reveal the existence of) another class's session.
  const session = await QrSession.findOne({ token: hashAttendanceCode(code), class: student.class, isActive: true }).select('+token');
  if (!session) throw ApiError.badRequest('This code is not valid for your class. Check it and try again.');
  if (session.expiresAt <= new Date()) throw ApiError.gone('This attendance code has expired. Ask your faculty for a new one.');

  const subject = await Subject.findById(session.subject).select('class students isActive name');
  if (!subject?.isActive) throw ApiError.forbidden('This subject is no longer active.');
  if (!isSameId(student.class, session.class) || !isSameId(student.class, subject.class)) {
    throw ApiError.forbidden('This attendance session is not for your class.');
  }
  if (Array.isArray(subject.students) && subject.students.length > 0 && !subject.students.some((id) => isSameId(id, student._id))) {
    throw ApiError.forbidden('You are not enrolled in this subject.');
  }

  // The unique attendance index is the final guard against duplicates. Upsert
  // metadata tells us whether this call created the record or one already
  // existed (e.g. the faculty already marked the student), so the student is
  // never told "present" when the stored status says otherwise.
  let outcome;
  try {
    outcome = await Attendance.findOneAndUpdate(
      { student: student._id, subject: session.subject, date: session.date, periodOrder: session.periodOrder },
      {
        $setOnInsert: {
          dayOfWeek: session.dayOfWeek,
          periodName: session.periodName,
          class: session.class,
          faculty: session.faculty,
          status: ATTENDANCE_STATUS.PRESENT,
          remarks: 'Marked via attendance code',
          markedAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true, includeResultMetadata: true },
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw ApiError.conflict('Your attendance for this period is already recorded.');
    }
    throw error;
  }

  const record = outcome.value;
  const created = outcome.lastErrorObject?.updatedExisting === false;
  const details = { subject: { id: subject._id, name: subject.name }, periodName: session.periodName, status: record.status };
  if (!created) {
    const error = ApiError.conflict(`Your attendance for this period is already recorded as ${record.status}.`);
    error.code = 'ATTENDANCE_ALREADY_MARKED';
    error.details = details;
    throw error;
  }

  // Bookkeeping for the faculty live view; the attendance write above is what counts.
  await QrSession.updateOne({ _id: session._id }, { $addToSet: { scannedStudents: student._id } });
  return sendResponse(res, 200, 'Attendance marked. You are present!', details);
});

export const getQrSessionStats = asyncHandler(async (req, res) => {
  const { subjectId, date, periodOrder } = req.query;
  const subject = await assertSubjectAccess(req, subjectId, { requireFaculty: true });
  const normalizedDate = normalizeToUtcMidnight(date);
  const dayName = getDayOfWeekName(date);
  const { slot: periodSlot, source } = await getClassPeriodSlot({ classId: subject.class._id, dayOfWeek: dayName, periodOrder: Number(periodOrder) });
  if (!periodSlot || periodSlot.kind !== PERIOD_KIND.CLASS) throw ApiError.badRequest(`Period ${periodOrder} is not an attendance class period on ${dayName}.`);
  if (source === 'class-timetable' && !isSameId(periodSlot.subject, subject._id)) {
    throw ApiError.forbidden('This subject is not scheduled for the selected class period.');
  }
  if (canonicalRole(req.user.role) !== ROLES.SUPER_ADMIN && source === 'class-timetable' && !isSameId(periodSlot.faculty, req.user._id)) {
    throw ApiError.forbidden('You are not assigned to this exact timetable period.');
  }

  const session = await QrSession.findOne({
    subject: subjectId,
    date: normalizedDate,
    periodOrder: Number(periodOrder),
    isActive: true,
  }).populate('scannedStudents', 'name registerNumber');

  if (!session) return sendResponse(res, 200, 'No active QR session', { session: null });

  const totalStudents = await Attendance.countDocuments({
    subject: subjectId,
    date: normalizedDate,
    periodOrder: Number(periodOrder),
  });

  return sendResponse(res, 200, 'QR session stats', {
    session: {
      sessionId: session._id,
      scannedCount: session.scannedStudents.length,
      scannedStudents: session.scannedStudents,
      totalMarked: totalStudents,
      expiresAt: session.expiresAt,
      isExpired: session.expiresAt <= new Date(),
    },
  });
});
