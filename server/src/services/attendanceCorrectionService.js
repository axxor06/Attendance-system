import mongoose from 'mongoose';
import { Attendance, AttendanceCorrection, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { CORRECTION_SOURCE, ROLES, canonicalRole, roleValues } from '../config/constants.js';
import { assertSubjectAccess } from '../utils/authorization.js';
import { resolveRoster, resolveSessionContext, normalizeToUtcMidnight } from './attendanceSessionService.js';
import { getOverallAttendance } from './attendanceService.js';
import { invalidateMemoryCache } from '../utils/memoryCache.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Attendance edit-window policy.
 *
 * Before this policy existed, faculty could rewrite any past date with no limit
 * and no trail. Corrections must work the next day (and beyond), so the window is
 * generous, but it is bounded and configurable rather than silently open-ended:
 *
 *   ATTENDANCE_CORRECTION_WINDOW_DAYS  default 30; 0 disables the limit.
 *
 * HOD is exempt (institution-wide authority); every HOD change is still audited.
 */
export function correctionWindowDays() {
  const raw = process.env.ATTENDANCE_CORRECTION_WINDOW_DAYS;
  if (raw === undefined || raw === '') return 30;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 3650 ? value : 30;
}

export function isHodUser(user) {
  return canonicalRole(user?.role) === ROLES.SUPER_ADMIN;
}

export function getEditability(actor, date, now = new Date()) {
  const windowDays = correctionWindowDays();
  if (isHodUser(actor) || windowDays === 0) return { editable: true, windowDays, lockedReason: null };
  const todayUtc = normalizeToUtcMidnight(now).getTime();
  const ageDays = Math.floor((todayUtc - normalizeToUtcMidnight(date).getTime()) / DAY_MS);
  if (ageDays > windowDays) {
    return {
      editable: false,
      windowDays,
      lockedReason: `Attendance older than ${windowDays} days can only be changed by the HOD.`,
    };
  }
  return { editable: true, windowDays, lockedReason: null };
}

export function assertEditable(actor, date) {
  const state = getEditability(actor, date);
  if (!state.editable) throw ApiError.forbidden(state.lockedReason);
  return state;
}

/** Attendance cannot be recorded for a day that has not started anywhere yet (1 day of timezone slack). */
export function assertNotFutureDate(date, now = new Date()) {
  const todayUtc = normalizeToUtcMidnight(now).getTime();
  if (normalizeToUtcMidnight(date).getTime() > todayUtc + DAY_MS) {
    throw ApiError.badRequest('Attendance cannot be recorded for a future date.');
  }
}

/**
 * Authorization for correcting a (subject, date, period) session.
 *
 *  - HOD: any session (every change is audited).
 *  - Faculty: must currently be authorized to teach the subject, AND either hold the
 *    timetable slot for that weekday/period now, OR have marked this very session
 *    themselves (covers timetable edits made after the class took place).
 *
 * Class, subject, period and student ids from the client are never trusted on their own.
 */
export async function authorizeSessionCorrection(req, { subjectId, date, periodOrder }) {
  const actor = req.user;
  const normalizedDate = normalizeToUtcMidnight(date);
  const period = Number(periodOrder);
  if (isHodUser(actor)) {
    const subject = await assertSubjectAccess(req, subjectId);
    await subject.populate('class');
    return { subject, normalizedDate, period, periodName: null };
  }

  const subject = await assertSubjectAccess(req, subjectId, { requireFaculty: true });
  await subject.populate('class');
  try {
    const { periodSlot } = await resolveSessionContext({ subjectId: subject._id, date: normalizedDate, periodOrder: period, facultyId: actor._id, isHod: false, departmentId: null });
    return { subject, normalizedDate, period, periodName: periodSlot.name };
  } catch (error) {
    if (error.statusCode !== 403 && error.statusCode !== 400) throw error;
    const markedByActor = await Attendance.exists({ subject: subject._id, date: normalizedDate, periodOrder: period, faculty: actor._id });
    if (!markedByActor) {
      throw error.statusCode === 403 ? error : ApiError.forbidden('You are not authorized to correct this session.');
    }
    const sample = await Attendance.findOne({ subject: subject._id, date: normalizedDate, periodOrder: period }).select('periodName').lean();
    return { subject, normalizedDate, period, periodName: sample?.periodName || `Period ${period}` };
  }
}

/** Runs `work(session)` in a transaction when the deployment supports them, else without one. */
export async function runAtomically(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => { result = await work(session); });
      return { result, transactional: true };
    } catch (error) {
      const unsupported = error?.code === 20 || /Transaction numbers are only allowed|replica set|IllegalOperation/i.test(String(error?.message));
      if (!unsupported) throw error;
    }
    return { result: await work(null), transactional: false };
  } finally {
    await session.endSession();
  }
}

async function rosterWithRecords(subject, normalizedDate, period) {
  const [roster, records] = await Promise.all([
    resolveRoster(subject),
    Attendance.find({ subject: subject._id, date: normalizedDate, periodOrder: period }).lean(),
  ]);
  const recordByStudent = new Map(records.map((record) => [String(record.student), record]));
  const known = new Set(roster.map((student) => String(student._id)));
  // Students who have a record but are no longer on the roster (class change, deactivation)
  // stay visible so the historical session can still be reviewed and corrected.
  const extraIds = records.map((record) => String(record.student)).filter((id) => !known.has(id));
  const extras = extraIds.length
    ? await User.find({ _id: { $in: extraIds }, role: { $in: roleValues(ROLES.USER) } }).select('name email registerNumber').lean()
    : [];
  return { students: [...roster.map((student) => student.toObject()), ...extras], recordByStudent };
}

/** Roster for the correction screen: every student with their stored status and last correction. */
export async function loadCorrectionRoster(ctx) {
  const { subject, normalizedDate, period } = ctx;
  const { students, recordByStudent } = await rosterWithRecords(subject, normalizedDate, period);
  const attendanceIds = [...recordByStudent.values()].map((record) => record._id);
  const lastCorrections = attendanceIds.length
    ? await AttendanceCorrection.aggregate([
      { $match: { attendance: { $in: attendanceIds } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: '$attendance', previousStatus: { $first: '$previousStatus' }, newStatus: { $first: '$newStatus' }, correctedBy: { $first: '$correctedBy' }, at: { $first: '$createdAt' }, count: { $sum: 1 } } },
    ])
    : [];
  const correctionByAttendance = new Map(lastCorrections.map((row) => [String(row._id), row]));
  return students
    .map((student) => {
      const record = recordByStudent.get(String(student._id));
      const correction = record ? correctionByAttendance.get(String(record._id)) : null;
      return {
        studentId: student._id,
        name: student.name,
        registerNumber: student.registerNumber || null,
        attendanceId: record?._id || null,
        status: record?.status || null,
        remarks: record?.remarks || '',
        markedAt: record?.markedAt || null,
        editedAt: record?.editedAt || null,
        correctionCount: correction?.count || 0,
        lastCorrection: correction ? { previousStatus: correction.previousStatus, newStatus: correction.newStatus, at: correction.at } : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Applies a batch of status changes to one session.
 *
 * - Existing records are UPDATED in place (never duplicated): the update is
 *   conditional on the status we read, so two simultaneous corrections cannot both
 *   win silently - the loser gets a 409 and must reload.
 * - Students with no record yet get one created through the unique index.
 * - Every change appends an AttendanceCorrection row; rows are never rewritten.
 * - In a replica-set deployment the whole batch is one transaction.
 */
export async function applySessionCorrections({ actor, ctx, changes, reason = '', source = CORRECTION_SOURCE.CORRECTION, requestMeta = {} }) {
  const { subject, normalizedDate, period } = ctx;
  const { students, recordByStudent } = await rosterWithRecords(subject, normalizedDate, period);
  const allowedStudentIds = new Set(students.map((student) => String(student._id)));

  const seen = new Set();
  for (const change of changes) {
    const studentId = String(change.studentId);
    if (seen.has(studentId)) throw ApiError.badRequest('Each student may appear only once in a correction.');
    seen.add(studentId);
    if (!allowedStudentIds.has(studentId)) throw ApiError.forbidden('Attendance can only be corrected for students enrolled in this subject.');
  }

  const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][normalizedDate.getUTCDay()];
  const periodName = ctx.periodName || [...recordByStudent.values()][0]?.periodName || `Period ${period}`;
  const now = new Date();
  const updated = [];
  const unchanged = [];

  const { transactional } = await runAtomically(async (dbSession) => {
    updated.length = 0;
    unchanged.length = 0;
    const opts = dbSession ? { session: dbSession } : {};
    for (const change of changes) {
      const existing = recordByStudent.get(String(change.studentId));
      let attendanceId;
      let previousStatus = null;

      if (existing) {
        const remarksChanged = change.remarks !== undefined && change.remarks !== existing.remarks;
        if (existing.status === change.status && !remarksChanged) {
          unchanged.push({ studentId: change.studentId, attendanceId: existing._id, status: existing.status });
          continue;
        }
        previousStatus = existing.status;
        const set = { status: change.status, editedAt: now, editedBy: actor._id };
        if (change.remarks !== undefined) set.remarks = change.remarks;
        const before = await Attendance.findOneAndUpdate({ _id: existing._id, status: existing.status }, { $set: set }, { new: false, ...opts }).lean();
        if (!before) throw ApiError.conflict('This attendance record was changed by someone else. Reload the session and try again.');
        attendanceId = existing._id;
        if (previousStatus === change.status) {
          // Remarks-only edit: nothing to audit as a status change.
          updated.push({ studentId: change.studentId, attendanceId, previousStatus, newStatus: change.status });
          continue;
        }
      } else {
        const outcome = await Attendance.findOneAndUpdate(
          { student: change.studentId, subject: subject._id, date: normalizedDate, periodOrder: period },
          {
            $setOnInsert: {
              dayOfWeek: dayName,
              periodName,
              class: subject.class._id || subject.class,
              faculty: actor._id,
              status: change.status,
              remarks: change.remarks || '',
              markedAt: now,
              editedAt: now,
              editedBy: actor._id,
            },
          },
          { upsert: true, new: true, includeResultMetadata: true, ...opts },
        );
        if (outcome.lastErrorObject?.updatedExisting) {
          throw ApiError.conflict('This attendance record was created by someone else. Reload the session and try again.');
        }
        attendanceId = outcome.value._id;
      }

      const auditRow = {
        attendance: attendanceId,
        student: change.studentId,
        class: subject.class._id || subject.class,
        subject: subject._id,
        date: normalizedDate,
        periodOrder: period,
        periodName,
        previousStatus,
        newStatus: change.status,
        correctedBy: actor._id,
        reason: reason || '',
        source,
      };
      try {
        await AttendanceCorrection.create([auditRow], opts);
      } catch (auditError) {
        if (!dbSession && existing) {
          // No transaction available: undo the status change so a correction is never unaudited.
          await Attendance.updateOne({ _id: attendanceId }, { $set: { status: previousStatus, editedAt: existing.editedAt || null, editedBy: existing.editedBy || null } });
        }
        throw auditError;
      }
      updated.push({ studentId: change.studentId, attendanceId, previousStatus, newStatus: change.status });
    }
  });

  // Institution-wide dashboard aggregates must reflect the change immediately.
  if (updated.length) invalidateMemoryCache('hod:');

  // Recalculate with the existing business rule (present + late count as attended).
  const percentages = await Promise.all(updated.slice(0, 50).map(async (row) => {
    const overall = await getOverallAttendance({ studentId: new mongoose.Types.ObjectId(String(row.studentId)) });
    return [String(row.studentId), overall];
  }));
  const overallByStudent = new Map(percentages);
  return {
    transactional,
    periodName,
    updated: updated.map((row) => ({ ...row, overall: overallByStudent.get(String(row.studentId)) || null })),
    unchanged,
    requestMeta,
  };
}
