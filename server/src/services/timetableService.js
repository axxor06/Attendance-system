import mongoose from 'mongoose';
import { PeriodTemplate, Timetable } from '../models/index.js';

export function slotsOverlap(left, right) {
  if (left.startTime && left.endTime && right.startTime && right.endTime) {
    return left.startTime < right.endTime && right.startTime < left.endTime;
  }
  return Number(left.order) === Number(right.order);
}

export async function findFacultyAssignmentConflicts({ facultyId, dayOfWeek, slot, excludeTimetableId = null, excludeSlotId = null, session = null }) {
  const query = Timetable.find({ isActive: true, 'days.dayOfWeek': dayOfWeek, 'days.slots.faculty': facultyId })
    .select('_id class days')
    .lean();
  if (session) query.session(session);
  const timetables = await query;
  return timetables.flatMap((timetable) => {
    const day = timetable.days.find((item) => item.dayOfWeek === dayOfWeek);
    return (day?.slots || [])
      .filter((candidate) => {
        if (excludeTimetableId && String(timetable._id) === String(excludeTimetableId) && excludeSlotId && String(candidate._id) === String(excludeSlotId)) return false;
        return String(candidate.faculty) === String(facultyId) && candidate.kind === 'class' && slotsOverlap(candidate, slot);
      })
      .map((candidate) => ({ timetableId: timetable._id, classId: timetable.class, slotId: candidate._id, order: candidate.order }));
  });
}

export async function assertFacultyAvailable(options) {
  const conflicts = await findFacultyAssignmentConflicts(options);
  return conflicts;
}

export async function getClassDaySchedule(classId, dayOfWeek) {
  const timetable = await Timetable.findOne({ class: classId, isActive: true })
    .populate('days.slots.subject', 'name code')
    .populate('days.slots.faculty', 'name employeeId')
    .lean();
  if (timetable) {
    const day = timetable.days.find((item) => item.dayOfWeek === dayOfWeek);
    return {
      slots: day?.slots || [],
      source: 'class-timetable',
      timetable,
    };
  }

  const legacyTemplate = await PeriodTemplate.findOne({ dayOfWeek, isActive: true }).lean();
  return {
    slots: legacyTemplate?.periods || [],
    source: 'legacy-template',
    timetable: null,
  };
}

export async function getClassPeriodSlot({ classId, dayOfWeek, periodOrder }) {
  const schedule = await getClassDaySchedule(classId, dayOfWeek);
  const slot = schedule.slots.find((item) => Number(item.order) === Number(periodOrder));
  return { ...schedule, slot: slot || null };
}

export async function getFacultyTimetableAccessIds(facultyId) {
  if (!facultyId || !mongoose.isValidObjectId(facultyId)) return { subjectIds: [], classIds: [] };
  const facultyObjectId = new mongoose.Types.ObjectId(String(facultyId));
  const rows = await Timetable.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$days' },
    { $unwind: '$days.slots' },
    { $match: { 'days.slots.faculty': facultyObjectId, 'days.slots.subject': { $ne: null }, 'days.slots.kind': 'class' } },
    { $group: { _id: null, subjectIds: { $addToSet: '$days.slots.subject' }, classIds: { $addToSet: '$class' } } },
  ]);
  return rows[0] || { subjectIds: [], classIds: [] };
}

/**
 * Faculty subject discovery must agree with exact timetable ownership. A
 * subject.faculty entry can represent a qualified/eligible Faculty member,
 * while the actual day and period owner is stored on Timetable.days.slots.
 * Active class timetables therefore take precedence; the direct subject list
 * is retained only for classes that still use the legacy period-template path.
 */
export async function getFacultySubjectScope(facultyId) {
  if (!facultyId || !mongoose.isValidObjectId(facultyId)) return { _id: null };
  const [{ subjectIds }, activeTimetableClasses] = await Promise.all([
    getFacultyTimetableAccessIds(facultyId),
    Timetable.distinct('class', { isActive: true }),
  ]);
  return {
    $or: [
      { _id: { $in: subjectIds } },
      { faculty: facultyId, class: { $nin: activeTimetableClasses } },
    ],
  };
}
