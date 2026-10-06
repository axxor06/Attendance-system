import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import { QrSession, Subject, Attendance, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { PERIOD_KIND, ATTENDANCE_STATUS, canonicalRole, ROLES } from '../config/constants.js';
import { assertSubjectAccess, isSameId } from '../utils/authorization.js';
import { getClassPeriodSlot } from '../services/timetableService.js';

const QR_EXPIRES_MINUTES = 5;

function hashQrToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

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

  const expiresAt = new Date(Date.now() + QR_EXPIRES_MINUTES * 60 * 1000);
  const rawToken = crypto.randomBytes(32).toString('base64url');
  let session;
  try {
    session = await QrSession.create({
      subject: subject._id,
      class: subject.class._id,
      faculty: req.user._id,
      date: normalizedDate,
      dayOfWeek: dayName,
      periodOrder: Number(periodOrder),
      periodName: periodSlot.name,
      token: hashQrToken(rawToken),
      expiresAt,
      isActive: true,
      scannedStudents: [],
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw ApiError.conflict('Another QR session was generated for this period. Please refresh and try again.');
    }
    throw error;
  }

  return sendResponse(res, 201, 'QR session created', {
    sessionId: session._id,
    token: rawToken,
    expiresAt,
    subject: { id: subject._id, name: subject.name, code: subject.code },
    periodName: periodSlot.name,
    expiresInMinutes: QR_EXPIRES_MINUTES,
  });
});

export const scanQr = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') throw ApiError.badRequest('QR token is required.');
  const normalizedToken = token.trim();
  if (normalizedToken.length < 32 || normalizedToken.length > 2048) throw ApiError.badRequest('QR token is invalid.');
  if (canonicalRole(req.user.role) !== ROLES.USER || !req.user.isActive) throw ApiError.forbidden('Only active students can scan attendance QR codes.');

  const session = await QrSession.findOne({ token: hashQrToken(normalizedToken), isActive: true }).select('+token');
  if (!session) throw ApiError.badRequest('Unable to validate QR code.');
  if (session.expiresAt <= new Date()) throw ApiError.badRequest('QR code expired.');

  const student = await User.findById(req.user._id).select('role class isActive');
  const subject = await Subject.findById(session.subject).select('class students isActive name');
  if (!student?.isActive || !subject?.isActive) throw ApiError.forbidden('Your account or this subject is inactive.');
  if (!isSameId(student.class, session.class) || !isSameId(student.class, subject.class)) {
    throw ApiError.forbidden('This attendance session is not for your class.');
  }
  if (Array.isArray(subject.students) && subject.students.length > 0 && !subject.students.some((id) => isSameId(id, student._id))) {
    throw ApiError.forbidden('You are not enrolled in this class.');
  }

  // The unique attendance index is the final database guard. The atomic QR
  // update prevents two simultaneous scans from both being treated as new.
  try {
    await Attendance.findOneAndUpdate(
      { student: student._id, subject: session.subject, date: session.date, periodOrder: session.periodOrder },
      {
        $setOnInsert: {
          dayOfWeek: session.dayOfWeek,
          periodName: session.periodName,
          class: session.class,
          faculty: session.faculty,
          status: ATTENDANCE_STATUS.PRESENT,
          remarks: 'Marked via QR scan',
          markedAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  } catch (error) {
    if (error?.code === 11000) throw ApiError.conflict('Attendance has already been recorded.');
    throw error;
  }

  const claimedSession = await QrSession.findOneAndUpdate(
    {
      _id: session._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
      scannedStudents: { $ne: student._id },
    },
    { $addToSet: { scannedStudents: student._id } },
    { new: true }
  );

  if (!claimedSession) return sendResponse(res, 409, 'Attendance has already been recorded.');

  return sendResponse(res, 200, 'Attendance marked. You are present!', {
    subject: session.subject,
    periodName: session.periodName,
  });
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
