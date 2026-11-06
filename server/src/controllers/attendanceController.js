import asyncHandler from 'express-async-handler';
import { Attendance, AttendanceCorrection, Subject } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { notifyMany } from '../services/notificationService.js';
import { invalidateMemoryCache } from '../utils/memoryCache.js';
import { logActivity } from '../services/activityLogService.js';
import { checkAndNotifyLowAttendance } from '../services/lowAttendanceService.js';
import {
  applySessionCorrections,
  assertEditable,
  assertNotFutureDate,
  authorizeSessionCorrection,
} from '../services/attendanceCorrectionService.js';
import { assertClassAccess, assertStudentAccess, assertSubjectAccess, isSameId } from '../utils/authorization.js';
import { canonicalRole } from '../config/constants.js';
import { getClassDaySchedule, getFacultySubjectScope } from '../services/timetableService.js';
import { getDayOfWeekName, normalizeToUtcMidnight, resolveRoster, resolveSessionContext } from '../services/attendanceSessionService.js';
import {
  ACTIVITY_ACTION,
  NOTIFICATION_TYPE,
  DAYS_OF_WEEK,
  CORRECTION_SOURCE,
  PERIOD_KIND,
  ROLES,
} from '../config/constants.js';

/**
 * Marks attendance for an entire session (subject + date + period) in one
 * call: faculty submits a list of { studentId, status, remarks } entries.
 * Upserts each entry independently so re-submitting/correcting a session
 * before period end doesn't create duplicates (unique index also guards this).
 */
export const markAttendance = asyncHandler(async (req, res) => {
  const { subjectId, date, periodOrder, entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    throw ApiError.badRequest('At least one attendance entry is required.');
  }

  const isHod = canonicalRole(req.user.role) === ROLES.SUPER_ADMIN;
  const { subject, periodSlot, dayName } = await resolveSessionContext({
    subjectId,
    date,
    periodOrder,
    facultyId: req.user._id,
    isHod,
    departmentId: req.user.department,
  });

  const normalizedDate = normalizeToUtcMidnight(date);
  const period = Number(periodOrder);
  // Same date policy as corrections: no future dates, and faculty edits are bounded by the
  // configurable correction window (HOD exempt). See attendanceCorrectionService.
  assertNotFutureDate(normalizedDate);
  assertEditable(req.user, normalizedDate);
  const studentIds = entries.map((entry) => entry.studentId);
  const studentIdStrings = studentIds.map((studentId) => studentId.toString());
  if (new Set(studentIdStrings).size !== studentIdStrings.length) {
    throw ApiError.badRequest('Each student may appear only once in an attendance submission.');
  }

  const roster = await resolveRoster(subject);
  const rosterIds = new Set(roster.map((student) => student._id.toString()));
  const unauthorizedStudent = studentIdStrings.find((studentId) => !rosterIds.has(studentId));
  if (unauthorizedStudent) {
    throw ApiError.forbidden('Attendance can only be marked for active students enrolled in this subject.');
  }

  // Re-submitting a session over existing records is a correction in everything but name,
  // so remember what was stored before and audit every status that actually changes.
  const beforeRows = await Attendance.find({
    subject: subject._id,
    date: normalizedDate,
    periodOrder: period,
    student: { $in: studentIds },
  }).select('_id student status').lean();
  const beforeByStudent = new Map(beforeRows.map((row) => [row.student.toString(), row]));

  await Attendance.bulkWrite(
    entries.map((entry) => ({
      updateOne: {
        filter: {
          student: entry.studentId,
          subject: subject._id,
          date: normalizedDate,
          periodOrder: period,
        },
        update: {
          $set: {
            dayOfWeek: dayName,
            periodName: periodSlot.name,
            class: subject.class._id,
            faculty: req.user._id,
            status: entry.status,
            remarks: entry.remarks || '',
            markedAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  const results = await Attendance.find({
    subject: subject._id,
    date: normalizedDate,
    periodOrder: period,
    student: { $in: entries.map((entry) => entry.studentId) },
  }).lean();

  invalidateMemoryCache('hod:');
  const changedEntries = entries.filter((entry) => {
    const before = beforeByStudent.get(entry.studentId.toString());
    return before && before.status !== entry.status;
  });
  if (changedEntries.length) {
    await AttendanceCorrection.insertMany(changedEntries.map((entry) => {
      const before = beforeByStudent.get(entry.studentId.toString());
      return {
        attendance: before._id,
        student: entry.studentId,
        class: subject.class._id,
        subject: subject._id,
        date: normalizedDate,
        periodOrder: period,
        periodName: periodSlot.name,
        previousStatus: before.status,
        newStatus: entry.status,
        correctedBy: req.user._id,
        reason: 'Session re-submitted',
        source: CORRECTION_SOURCE.RESUBMIT,
      };
    }));
  }

  // Notify students of newly marked attendance (best-effort, non-blocking semantics).
  await notifyMany({
    userIds: studentIds,
    type: NOTIFICATION_TYPE.ATTENDANCE_MARKED,
    title: `Attendance marked - ${subject.name}`,
    message: `Your attendance for ${subject.name} (${periodSlot.name}, ${dayName}) has been recorded.`,
    meta: { subjectId: subject._id, periodOrder, date: normalizedDate },
  });

  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.MARK_ATTENDANCE,
    targetType: 'Subject',
    targetId: subject._id,
    description: `Marked attendance for ${entries.length} student(s) in ${subject.name}, ${periodSlot.name}`,
  });

  // Low-attendance warnings are a background side effect, not part of the
  // faculty's "did my save succeed" response: run them after responding,
  // concurrently per student rather than one-by-one.
  checkAndNotifyLowAttendance(studentIds, subject).catch((err) =>
    console.error('[LowAttendance] background check failed:', err.message)
  );

  return sendResponse(res, 200, 'Attendance marked successfully', {
    count: results.length,
    records: results,
  });
});

/**
 * Returns the attendance roster for a specific session (subject+date+period),
 * pre-filled with existing statuses if already marked, so the faculty UI
 * can render a take/edit form either way.
 */
export const getSessionRoster = asyncHandler(async (req, res) => {
  const { subjectId, date, periodOrder } = req.query;

  if (!subjectId || !date || !periodOrder) {
    throw ApiError.badRequest('subjectId, date, and periodOrder are required.');
  }

  const isHod = canonicalRole(req.user.role) === ROLES.SUPER_ADMIN;
  const { subject, periodSlot, dayName } = await resolveSessionContext({
    subjectId,
    date,
    periodOrder: Number(periodOrder),
    facultyId: req.user._id,
    isHod,
    departmentId: req.user.department,
  });

  const normalizedDate = normalizeToUtcMidnight(date);
  const roster = await resolveRoster(subject);

  const existing = await Attendance.find({
    subject: subject._id,
    date: normalizedDate,
    periodOrder: Number(periodOrder),
  });
  const existingByStudent = new Map(existing.map((e) => [e.student.toString(), e]));

  const sessionRoster = roster
    .map((student) => {
      const record = existingByStudent.get(student._id.toString());
      return {
        studentId: student._id,
        name: student.name,
        email: student.email,
        status: record?.status || null,
        remarks: record?.remarks || '',
        alreadyMarked: !!record,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return sendResponse(res, 200, 'Session roster fetched', {
    subject: { id: subject._id, name: subject.name, code: subject.code },
    dayOfWeek: dayName,
    periodOrder: periodSlot.order,
    periodName: periodSlot.name,
    roster: sessionRoster,
  });
});

/**
 * Edits a single attendance entry for any date inside the correction window.
 * Shares authorization, window policy, atomic update and audit trail with the
 * batch correction endpoint (see attendanceCorrectionService).
 */
export const editAttendanceEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, remarks, reason } = req.body;

  const record = await Attendance.findById(id).select('subject date periodOrder student').lean();
  if (!record) throw ApiError.notFound('Attendance record not found');

  const ctx = await authorizeSessionCorrection(req, { subjectId: record.subject, date: record.date, periodOrder: record.periodOrder });
  assertEditable(req.user, record.date);

  await applySessionCorrections({
    actor: req.user,
    ctx,
    changes: [{ studentId: record.student, status, remarks }],
    reason: typeof reason === 'string' ? reason.trim() : '',
    source: CORRECTION_SOURCE.EDIT,
  });
  const fresh = await Attendance.findById(id);

  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.EDIT_ATTENDANCE,
    targetType: 'Attendance',
    targetId: fresh._id,
    description: `Edited attendance entry to '${status}'`,
  });

  return sendResponse(res, 200, 'Attendance entry updated successfully', { record: fresh });
});

/**
 * Generic attendance history fetch with flexible filters - used by
 * student "attendance history" view and faculty "recent attendance" view.
 */
export const getAttendanceHistory = asyncHandler(async (req, res) => {
  const { studentId, subjectId, classId, from, to, page = 1, limit = 50 } = req.query;

  const filter = {};


  if (req.user.role === ROLES.USER) {
    filter.student = req.user._id;
  } else if (studentId) {
    await assertStudentAccess(req, studentId);
    filter.student = studentId;
  }

  if (subjectId) {
    await assertSubjectAccess(req, subjectId);
    filter.subject = subjectId;
  }
  if (classId) {
    await assertClassAccess(req, classId);
    filter.class = classId;
  }
  if (req.user.role === ROLES.ADMIN) {
    filter.faculty = req.user._id;
  }
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = normalizeToUtcMidnight(from);
    if (to) filter.date.$lte = normalizeToUtcMidnight(to);
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(200, Math.max(1, Number(limit)));

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('subject', 'name code')
      .populate('student', 'name registerNumber')
      .populate('faculty', 'name')
      .sort({ date: -1, periodOrder: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Attendance.countDocuments(filter),
  ]);

  return sendResponse(res, 200, 'Attendance history fetched', {
    records,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
});

/**
 * Returns which subjects have NOT yet had attendance marked for the
 * current faculty member, for "today" across all their assigned subjects
 * and today's active periods - powers the "Attendance Pending" dashboard
 * widget.
 */
export const getPendingAttendance = asyncHandler(async (req, res) => {
  const today = normalizeToUtcMidnight(new Date());
  const dayName = getDayOfWeekName(new Date());

  const facultySubjectScope = await getFacultySubjectScope(req.user._id);
  const subjects = await Subject.find({ isActive: true, ...facultySubjectScope }).populate(
    'class',
    'name code'
  );
  const subjectSchedules = await Promise.all(subjects.map(async (subject) => {
    if (!subject.class?._id) return { subject, periods: [] };
    const schedule = await getClassDaySchedule(subject.class._id, dayName);
    return {
      subject,
      periods: schedule.slots.filter((period) => (
        period.kind === PERIOD_KIND.CLASS
        && isSameId(period.subject, subject._id)
        && isSameId(period.faculty, req.user._id)
      )),
    };
  }));
  const periodOrders = [...new Set(subjectSchedules.flatMap(({ periods }) => periods.map((period) => period.order)))];
  const markedSessions = await Attendance.find({
    faculty: req.user._id,
    date: today,
    periodOrder: { $in: periodOrders },
  }).select('subject periodOrder').lean();
  const markedKeys = new Set(markedSessions.map((record) => `${record.subject.toString()}:${record.periodOrder}`));

  const pending = [];
  for (const { subject, periods } of subjectSchedules) {
    for (const period of periods) {
      if (!markedKeys.has(`${subject._id.toString()}:${period.order}`)) {
        pending.push({
          subjectId: subject._id,
          subjectName: subject.name,
          className: subject.class?.name,
          periodOrder: period.order,
          periodName: period.name,
        });
      }
    }
  }

  return sendResponse(res, 200, 'Pending attendance fetched', { pending, dayOfWeek: dayName });
});
