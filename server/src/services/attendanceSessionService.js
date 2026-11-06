import { Subject, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { PERIOD_KIND, ROLES, roleValues } from '../config/constants.js';
import { isSameId } from '../utils/authorization.js';
import { getClassPeriodSlot } from './timetableService.js';

/**
 * Shared building blocks for anything that works on one attendance "session":
 * a (subject, date, period) triple. Used by marking, QR and corrections so the
 * rules cannot drift apart.
 */

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** ISO date-only inputs represent UTC midnight; weekday resolution is UTC everywhere. */
export function getDayOfWeekName(date) {
  return DAY_NAMES[new Date(date).getUTCDay()];
}

export function normalizeToUtcMidnight(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest('A valid date is required.');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Verifies the requesting faculty/HOD is authorized to take attendance for the
 * subject and resolves + validates the period against that day's timetable.
 * Returns { subject, periodSlot, dayName }.
 */
export async function resolveSessionContext({ subjectId, date, periodOrder, facultyId, isHod, departmentId }) {
  // A HOD with a department is limited to that department's subjects (existing behaviour);
  // a HOD without one is institution-wide.
  const subject = await Subject.findOne({ _id: subjectId, ...(isHod && departmentId ? { department: departmentId } : {}) }).populate('class');
  if (!subject) throw ApiError.notFound('Subject not found');

  const directlyAssignedToSubject = subject.faculty.some((f) => f.toString() === facultyId.toString());
  const dayName = getDayOfWeekName(date);
  const { slot: periodSlot, source } = await getClassPeriodSlot({ classId: subject.class._id, dayOfWeek: dayName, periodOrder });
  if (!periodSlot) throw ApiError.badRequest(`Period ${periodOrder} does not exist in ${dayName}'s class timetable.`);
  if (!isHod && source !== 'class-timetable' && !directlyAssignedToSubject) {
    throw ApiError.forbidden('You are not assigned to teach this subject.');
  }
  if (source === 'class-timetable' && !isSameId(periodSlot.subject, subject._id)) {
    throw ApiError.forbidden('This subject is not scheduled for the selected class period.');
  }
  if (!isHod && source === 'class-timetable' && !isSameId(periodSlot.faculty, facultyId)) {
    throw ApiError.forbidden('You are not assigned to this exact timetable period.');
  }
  if (periodSlot.kind !== PERIOD_KIND.CLASS) {
    throw ApiError.badRequest(`"${periodSlot.name}" is a break period and cannot take attendance.`);
  }
  return { subject, periodSlot, dayName };
}

/** Override roster if the subject has one, otherwise every active student in its class. */
export async function resolveRoster(subject) {
  if (subject.students && subject.students.length > 0) {
    return User.find({ _id: { $in: subject.students }, role: { $in: roleValues(ROLES.USER) }, isActive: true }).select('name email registerNumber');
  }
  return User.find({ class: subject.class._id || subject.class, role: { $in: roleValues(ROLES.USER) }, isActive: true }).select('name email registerNumber');
}
