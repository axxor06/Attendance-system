import asyncHandler from 'express-async-handler';
import { Attendance, Subject, PeriodTemplate, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { notifyMany, notifyUser } from '../services/notificationService.js';
import { logActivity } from '../services/activityLogService.js';
import { sendLowAttendanceEmail } from '../utils/email.js';
import { getOverallAttendance } from '../services/attendanceService.js';
import { assertClassAccess, assertStudentAccess, assertSubjectAccess, getDepartmentScope, isSameId } from '../utils/authorization.js';
import {
  ACTIVITY_ACTION,
  NOTIFICATION_TYPE,
  DAYS_OF_WEEK,
  PERIOD_KIND,
  LOW_ATTENDANCE_THRESHOLD,
} from '../config/constants.js';

function getDayOfWeekName(date) {
  // JS getDay(): 0=Sunday...6=Saturday. DAYS_OF_WEEK starts at monday.
  const jsDay = new Date(date).getDay();
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[jsDay];
}

function normalizeToUtcMidnight(dateInput) {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Verifies the requesting faculty is authorized to mark attendance for
 * the given subject, and resolves+validates the period against that
 * day's active template. Returns { subject, periodSlot, dayName }.
 */
async function resolveSessionContext({ subjectId, date, periodOrder, facultyId, isHod, departmentId }) {
  const subject = await Subject.findOne({ _id: subjectId, ...(isHod ? { department: departmentId || null } : {}) }).populate('class');
  if (!subject) throw ApiError.notFound('Subject not found');

  if (!isHod && !subject.faculty.some((f) => f.toString() === facultyId.toString())) {
    throw ApiError.forbidden('You are not assigned to teach this subject.');
  }

  const dayName = getDayOfWeekName(date);
  const template = await PeriodTemplate.findOne({ dayOfWeek: dayName, isActive: true });
  if (!template) {
    throw ApiError.badRequest(`No period template is configured for ${dayName}.`);
  }

  const periodSlot = template.periods.find((p) => p.order === periodOrder);
  if (!periodSlot) {
    throw ApiError.badRequest(`Period ${periodOrder} does not exist in ${dayName}'s schedule.`);
  }

  if (periodSlot.kind !== PERIOD_KIND.CLASS) {
    throw ApiError.badRequest(`"${periodSlot.name}" is a break period and cannot take attendance.`);
  }

  return { subject, periodSlot, dayName };
}

/**
 * Resolves the roster of students for a subject (override list if set,
 * otherwise every student in the subject's class).
 */
async function resolveRoster(subject) {
  if (subject.students && subject.students.length > 0) {
    return User.find({ _id: { $in: subject.students }, role: 'student', isActive: true }).select('name email');
  }
  return User.find({ class: subject.class._id, role: 'student', isActive: true }).select('name email');
}

/**
 * Checks each student's overall attendance after a marking session and
 * sends a low-attendance email + notification to anyone who has dropped
 * below the threshold. Runs all students concurrently (rather than one
 * sequential DB round-trip per student) and is intended to be fired
 * after the HTTP response has already been sent, so a slow class roster
 * never delays the faculty member's "saved" confirmation.
 */
async function checkAndNotifyLowAttendance(studentIds, subject) {
  await Promise.all(
    studentIds.map(async (studentId) => {
      const overall = await getOverallAttendance({ studentId });
      if (overall.total < 5 || overall.percentage >= LOW_ATTENDANCE_THRESHOLD) return;

      const student = await User.findById(studentId);
      if (!student) return;

      await Promise.all([
        sendLowAttendanceEmail({
          to: student.email,
          name: student.name,
          subjectName: subject.name,
          percentage: overall.percentage,
        }).catch((err) => console.error('[Email] low attendance email failed:', err.message)),
        notifyUser({
          userId: studentId,
          type: NOTIFICATION_TYPE.LOW_ATTENDANCE,
          title: 'Low attendance warning',
          message: `Your overall attendance has dropped to ${overall.percentage}%.`,
          meta: { percentage: overall.percentage },
        }),
      ]);
    })
  );
}

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

  const isHod = req.user.role === 'hod';
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

  const isHod = req.user.role === 'hod';
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
 * Faculty edits a single attendance entry for "today" (or any date they're
 * authorized for - the spec specifically calls out editing today's
 * attendance, but we don't hard-block past edits here since faculty may
 * legitimately need to correct a recent mistake; the HOD can audit via
 * ActivityLog).
 */
export const editAttendanceEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  const record = await Attendance.findById(id).populate('subject');
  if (!record) throw ApiError.notFound('Attendance record not found');

  const subject = await assertSubjectAccess(req, record.subject?._id || record.subject, { requireFaculty: req.user.role === 'faculty' });
  const isHod = req.user.role === 'hod';
  if (!isHod) {
    const isAssignedFaculty = subject?.faculty?.some((facultyId) => isSameId(facultyId, req.user._id));
    if (req.user.role !== 'faculty' || !isAssignedFaculty) {
      throw ApiError.forbidden('You can only edit attendance for subjects you are assigned to teach.');
    }
  }

  record.status = status;
  if (remarks !== undefined) record.remarks = remarks;
  record.editedAt = new Date();
  record.editedBy = req.user._id;
  await record.save();

  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.EDIT_ATTENDANCE,
    targetType: 'Attendance',
    targetId: record._id,
    description: `Edited attendance entry to '${status}'`,
  });

  return sendResponse(res, 200, 'Attendance entry updated successfully', { record });
});

/**
 * Generic attendance history fetch with flexible filters - used by
 * student "attendance history" view and faculty "recent attendance" view.
 */
export const getAttendanceHistory = asyncHandler(async (req, res) => {
  const { studentId, subjectId, classId, from, to, page = 1, limit = 50 } = req.query;

  const filter = {};

  if (req.user.role === 'hod') {
    const scope = await getDepartmentScope(req);
    if (!scope?.departmentId || scope.classIds.length === 0) filter._id = null;
    else filter.class = { $in: scope.classIds };
  }

  if (req.user.role === 'student') {
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
  if (req.user.role === 'faculty') {
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

  const template = await PeriodTemplate.findOne({ dayOfWeek: dayName, isActive: true });
  if (!template) {
    return sendResponse(res, 200, 'No periods configured for today', { pending: [] });
  }

  const classPeriods = template.periods.filter((p) => p.kind === PERIOD_KIND.CLASS);

  const subjects = await Subject.find({ faculty: req.user._id, isActive: true }).populate(
    'class',
    'name code'
  );

  const periodOrders = classPeriods.map((period) => period.order);
  const markedSessions = await Attendance.find({
    faculty: req.user._id,
    date: today,
    periodOrder: { $in: periodOrders },
  }).select('subject periodOrder').lean();
  const markedKeys = new Set(markedSessions.map((record) => `${record.subject.toString()}:${record.periodOrder}`));

  const pending = [];
  for (const subject of subjects) {
    for (const period of classPeriods) {
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
