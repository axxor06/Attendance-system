import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import { QrSession, Subject, PeriodTemplate, Attendance, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { PERIOD_KIND, ATTENDANCE_STATUS, ROLES } from '../config/constants.js';
import { assertSubjectAccess, isSameId } from '../utils/authorization.js';

const QR_EXPIRES_MINUTES = 5;

function normalizeToUtcMidnight(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('A valid date is required.');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getDayOfWeekName(date) {
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[new Date(date).getDay()];
}

export const generateQr = asyncHandler(async (req, res) => {
  const { subjectId, date, periodOrder } = req.body;
  const subject = await assertSubjectAccess(req, subjectId, { requireFaculty: true });

  const normalizedDate = normalizeToUtcMidnight(date);
  const dayName = getDayOfWeekName(date);
  const template = await PeriodTemplate.findOne({ dayOfWeek: dayName, isActive: true });
  if (!template) throw ApiError.badRequest(`No period template configured for ${dayName}.`);

  const periodSlot = template.periods.find((p) => p.order === Number(periodOrder));
  if (!periodSlot) throw ApiError.badRequest(`Period ${periodOrder} not found in ${dayName}'s schedule.`);
  if (periodSlot.kind !== PERIOD_KIND.CLASS) throw ApiError.badRequest(`"${periodSlot.name}" is a break period.`);

  await QrSession.updateMany(
    { subject: subject._id, date: normalizedDate, periodOrder: Number(periodOrder), isActive: true },
    { $set: { isActive: false } }
  );

  const expiresAt = new Date(Date.now() + QR_EXPIRES_MINUTES * 60 * 1000);
  const token = crypto.randomBytes(32).toString('hex');
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
      token,
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
    token,
    expiresAt,
    subject: { id: subject._id, name: subject.name, code: subject.code },
    periodName: periodSlot.name,
    expiresInMinutes: QR_EXPIRES_MINUTES,
  });
});

export const scanQr = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw ApiError.badRequest('QR token is required.');
  if (req.user.role !== ROLES.STUDENT || !req.user.isActive) throw ApiError.forbidden('Only active students can scan attendance QR codes.');

  const session = await QrSession.findOne({ token, isActive: true });
  if (!session) throw ApiError.badRequest('This QR code is invalid or has already been replaced.');
  if (session.expiresAt <= new Date()) throw ApiError.badRequest('This QR code has expired. Ask your faculty to generate a new one.');

  const student = await User.findById(req.user._id).select('role class isActive');
  const subject = await Subject.findById(session.subject).select('class students isActive name');
  if (!student?.isActive || !subject?.isActive) throw ApiError.forbidden('Your account or this subject is inactive.');
  if (!isSameId(student.class, session.class) || !isSameId(student.class, subject.class)) {
    throw ApiError.forbidden('This QR code is not for your class.');
  }
  if (Array.isArray(subject.students) && subject.students.length > 0 && !subject.students.some((id) => isSameId(id, student._id))) {
    throw ApiError.forbidden('You are not enrolled in this subject.');
  }

  // The unique attendance index is the final database guard. The atomic QR
  // update prevents two simultaneous scans from both being treated as new.
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

  if (!claimedSession) return sendResponse(res, 200, 'Your attendance is already recorded for this session.');

  return sendResponse(res, 200, 'Attendance marked. You are present!', {
    subject: session.subject,
    periodName: session.periodName,
  });
});

export const getQrSessionStats = asyncHandler(async (req, res) => {
  const { subjectId, date, periodOrder } = req.query;
  await assertSubjectAccess(req, subjectId, { requireFaculty: true });
  const normalizedDate = normalizeToUtcMidnight(date);

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
