import asyncHandler from 'express-async-handler';
import { Attendance, AttendanceCorrection, Class, Subject, Timetable } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { ACTIVITY_ACTION, CORRECTION_SOURCE, NOTIFICATION_TYPE, PERIOD_KIND, PRESENT_LIKE_STATUSES } from '../config/constants.js';
import { assertClassAccess, isSameId } from '../utils/authorization.js';
import { getFacultySubjectScope } from '../services/timetableService.js';
import { getDayOfWeekName, normalizeToUtcMidnight } from '../services/attendanceSessionService.js';
import {
  applySessionCorrections,
  assertEditable,
  assertNotFutureDate,
  authorizeSessionCorrection,
  getEditability,
  isHodUser,
  loadCorrectionRoster,
} from '../services/attendanceCorrectionService.js';
import { notifyMany } from '../services/notificationService.js';
import { checkAndNotifyLowAttendance } from '../services/lowAttendanceService.js';
import { logActivity } from '../services/activityLogService.js';
import { paginationMeta, parsePagination } from '../utils/pagination.js';

const id = (value) => String(value?._id || value);

async function facultySubjectIdList(userId) {
  const scope = await getFacultySubjectScope(userId);
  const subjects = await Subject.find({ isActive: true, ...scope }).select('_id class').lean();
  return subjects;
}

/**
 * Step 1-5 of the faculty workflow: which sessions exist on a chosen date.
 * Sessions come from stored attendance (what can be corrected) plus, for faculty,
 * the periods their timetable says they taught that day but never marked.
 */
export const listCorrectableSessions = asyncHandler(async (req, res) => {
  const { date, classId } = req.query;
  const normalizedDate = normalizeToUtcMidnight(date);
  assertNotFutureDate(normalizedDate);
  const hod = isHodUser(req.user);
  if (classId) await assertClassAccess(req, classId);

  const match = { date: normalizedDate };
  if (classId) match.class = classId;
  let scopedSubjects = null;
  if (!hod) {
    scopedSubjects = await facultySubjectIdList(req.user._id);
    match.subject = { $in: scopedSubjects.map((subject) => subject._id) };
  }

  const groups = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: { subject: '$subject', class: '$class', periodOrder: '$periodOrder' },
        periodName: { $first: '$periodName' },
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $in: ['$status', PRESENT_LIKE_STATUSES] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        lastEditedAt: { $max: '$editedAt' },
        markedBy: { $addToSet: '$faculty' },
      },
    },
    { $limit: 400 },
  ]);

  const dayName = getDayOfWeekName(normalizedDate);
  let ownedSlots = [];
  if (!hod) {
    const timetables = await Timetable.find({ isActive: true, 'days.dayOfWeek': dayName, 'days.slots.faculty': req.user._id })
      .select('class days')
      .lean();
    ownedSlots = timetables.flatMap((timetable) => {
      const day = (timetable.days || []).find((item) => item.dayOfWeek === dayName);
      return (day?.slots || [])
        .filter((slot) => slot.kind === PERIOD_KIND.CLASS && slot.subject && isSameId(slot.faculty, req.user._id))
        .map((slot) => ({ classId: id(timetable.class), subjectId: id(slot.subject), periodOrder: slot.order, periodName: slot.name, startTime: slot.startTime || null, endTime: slot.endTime || null }));
    });
    if (classId) ownedSlots = ownedSlots.filter((slot) => slot.classId === String(classId));
  }
  const ownedKeys = new Set(ownedSlots.map((slot) => `${slot.subjectId}:${slot.periodOrder}`));

  const sessions = new Map();
  for (const group of groups) {
    const key = `${id(group._id.subject)}:${group._id.periodOrder}`;
    // Faculty see a stored session only if they hold the slot now or marked it themselves.
    if (!hod && !ownedKeys.has(key) && !group.markedBy.some((facultyId) => isSameId(facultyId, req.user._id))) continue;
    sessions.set(key, {
      subjectId: id(group._id.subject),
      classId: id(group._id.class),
      periodOrder: group._id.periodOrder,
      periodName: group.periodName,
      marked: true,
      markedCount: group.total,
      presentCount: group.present,
      absentCount: group.absent,
      lastEditedAt: group.lastEditedAt || null,
    });
  }
  for (const slot of ownedSlots) {
    const key = `${slot.subjectId}:${slot.periodOrder}`;
    if (sessions.has(key)) {
      Object.assign(sessions.get(key), { startTime: slot.startTime, endTime: slot.endTime });
      continue;
    }
    sessions.set(key, { ...slot, marked: false, markedCount: 0, presentCount: 0, absentCount: 0, lastEditedAt: null });
  }

  const rows = [...sessions.values()];
  const [subjects, classes] = await Promise.all([
    Subject.find({ _id: { $in: [...new Set(rows.map((row) => row.subjectId))] } }).select('name code').lean(),
    Class.find({ _id: { $in: [...new Set(rows.map((row) => row.classId))] } }).select('name code').lean(),
  ]);
  const subjectById = new Map(subjects.map((subject) => [id(subject), subject]));
  const classById = new Map(classes.map((classDoc) => [id(classDoc), classDoc]));
  const result = rows
    .map((row) => ({
      ...row,
      subjectName: subjectById.get(row.subjectId)?.name || 'Subject',
      subjectCode: subjectById.get(row.subjectId)?.code || '',
      className: classById.get(row.classId)?.name || 'Class',
      classCode: classById.get(row.classId)?.code || '',
    }))
    .sort((a, b) => a.className.localeCompare(b.className) || a.periodOrder - b.periodOrder);

  return sendResponse(res, 200, 'Sessions fetched', {
    date: normalizedDate.toISOString().slice(0, 10),
    dayOfWeek: dayName,
    ...getEditability(req.user, normalizedDate),
    sessions: result,
  });
});

export const getCorrectionRoster = asyncHandler(async (req, res) => {
  const { subjectId, date, periodOrder } = req.query;
  const ctx = await authorizeSessionCorrection(req, { subjectId, date, periodOrder });
  assertNotFutureDate(ctx.normalizedDate);
  const roster = await loadCorrectionRoster(ctx);
  return sendResponse(res, 200, 'Correction roster fetched', {
    subject: { id: ctx.subject._id, name: ctx.subject.name, code: ctx.subject.code },
    class: { id: ctx.subject.class._id, name: ctx.subject.class.name, code: ctx.subject.class.code },
    date: ctx.normalizedDate.toISOString().slice(0, 10),
    periodOrder: ctx.period,
    ...getEditability(req.user, ctx.normalizedDate),
    roster,
  });
});

export const submitCorrections = asyncHandler(async (req, res) => {
  const { subjectId, date, periodOrder, changes, reason } = req.body;
  const ctx = await authorizeSessionCorrection(req, { subjectId, date, periodOrder });
  assertNotFutureDate(ctx.normalizedDate);
  assertEditable(req.user, ctx.normalizedDate);

  const outcome = await applySessionCorrections({
    actor: req.user,
    ctx,
    changes: changes.map((change) => ({ studentId: change.studentId, status: change.status, remarks: change.remarks })),
    reason: typeof reason === 'string' ? reason.trim() : '',
    source: CORRECTION_SOURCE.CORRECTION,
  });

  const statusChanged = outcome.updated.filter((row) => row.previousStatus !== row.newStatus);
  if (statusChanged.length) {
    const dateLabel = ctx.normalizedDate.toISOString().slice(0, 10);
    // Best-effort side effects: the correction itself is already committed and audited.
    await Promise.allSettled(statusChanged.map((row) => notifyMany({
      userIds: [row.studentId],
      type: NOTIFICATION_TYPE.ATTENDANCE_CORRECTED,
      title: `Attendance updated - ${ctx.subject.name}`,
      message: `Your attendance for ${ctx.subject.name} on ${dateLabel} (${outcome.periodName}) was changed to ${row.newStatus}.`,
      meta: { attendanceId: row.attendanceId, subjectId: ctx.subject._id, date: ctx.normalizedDate, status: row.newStatus },
    })));
    checkAndNotifyLowAttendance(statusChanged.filter((row) => !PRESENT_LIKE_STATUSES.includes(row.newStatus)).map((row) => row.studentId), ctx.subject)
      .catch((error) => console.error('[LowAttendance] correction check failed:', error.message));
  }
  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.CORRECT_ATTENDANCE,
    targetType: 'Subject',
    targetId: ctx.subject._id,
    description: `Corrected ${statusChanged.length} attendance record(s) for ${ctx.subject.name}, ${outcome.periodName}, ${ctx.normalizedDate.toISOString().slice(0, 10)}`,
    reason: typeof reason === 'string' ? reason.trim().slice(0, 500) : undefined,
    ipAddress: req.ip,
    requestId: req.id,
  });

  return sendResponse(res, 200, statusChanged.length ? 'Attendance correction saved.' : 'No changes to save.', {
    updated: outcome.updated,
    unchanged: outcome.unchanged,
    transactional: outcome.transactional,
  });
});

/** Append-only audit trail. HOD sees everything; faculty see their own corrections and those on their subjects. */
export const listCorrections = asyncHandler(async (req, res) => {
  const { classId, subjectId, studentId, facultyId, from, to } = req.query;
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const filter = {};
  if (classId) filter.class = classId;
  if (subjectId) filter.subject = subjectId;
  if (studentId) filter.student = studentId;
  if (facultyId) filter.correctedBy = facultyId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = normalizeToUtcMidnight(from);
    if (to) filter.createdAt.$lt = new Date(normalizeToUtcMidnight(to).getTime() + 24 * 60 * 60 * 1000);
  }
  if (!isHodUser(req.user)) {
    const subjects = await facultySubjectIdList(req.user._id);
    filter.$and = [{ $or: [{ correctedBy: req.user._id }, { subject: { $in: subjects.map((subject) => subject._id) } }] }];
  }
  const [rows, total] = await Promise.all([
    AttendanceCorrection.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('student', 'name registerNumber')
      .populate('correctedBy', 'name')
      .populate('subject', 'name code')
      .populate('class', 'name code')
      .lean(),
    AttendanceCorrection.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Attendance corrections fetched', {
    corrections: rows.map((row) => ({
      _id: row._id,
      attendance: row.attendance,
      student: row.student,
      subject: row.subject,
      class: row.class,
      date: row.date,
      periodOrder: row.periodOrder,
      periodName: row.periodName,
      previousStatus: row.previousStatus,
      newStatus: row.newStatus,
      correctedBy: row.correctedBy,
      reason: row.reason,
      source: row.source,
      createdAt: row.createdAt,
    })),
    pagination: paginationMeta({ total, page, limit }),
  });
});
