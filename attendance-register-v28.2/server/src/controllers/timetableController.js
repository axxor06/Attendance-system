import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { Class, Subject, Timetable, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, canonicalRole, DAYS_OF_WEEK, PERIOD_KIND, roleValues, ROLES } from '../config/constants.js';
import { assertClassAccess, isSameId } from '../utils/authorization.js';
import { slotTimeOverlaps } from '../utils/timetableConflictUtils.js';

function dayEntry(days, dayOfWeek) {
  return (days || []).find((day) => day.dayOfWeek === dayOfWeek);
}
function normalizedObjectId(value) {
  return mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;
}

export function getTimetableConflictDetails(timetable, { dayOfWeek, slot, facultyId, classId, timetableId, slotId = null, currentClassName = null }) {
  // A break or free period has no Faculty and must never block every candidate.
  // Availability passes a hypothetical requested slot with no faculty. Compare
  // persisted candidate.faculty against the supplied candidate facultyId instead.
  const sameTimetable = isSameId(timetable.class, classId) && isSameId(timetable._id, timetableId);
  const day = dayEntry(timetable.days, dayOfWeek);
  return (day?.slots || []).filter((candidate) => {
    if (!candidate.faculty || candidate.kind === PERIOD_KIND.BREAK || !isSameId(candidate.faculty, facultyId)) return false;
    if (sameTimetable && slotId && isSameId(candidate._id, slotId)) return false;
    return slotTimeOverlaps(candidate, slot);
  }).map((candidate) => ({
    facultyId: String(facultyId),
    currentClassId: String(classId),
    currentClassName: currentClassName || null,
    currentTimetableId: timetableId ? String(timetableId) : null,
    conflictingTimetableId: String(timetable._id),
    conflictingClassId: String(timetable.class?._id || timetable.class),
    conflictingClassName: timetable.class?.name || null,
    dayOfWeek,
    order: Number(slot.order),
    currentStartTime: slot.startTime || null,
    currentEndTime: slot.endTime || null,
    conflictingStartTime: candidate.startTime || null,
    conflictingEndTime: candidate.endTime || null,
    currentSlotId: slot._id ? String(slot._id) : null,
    conflictingSlotId: candidate._id ? String(candidate._id) : null,
    startTime: slot.startTime || null,
    endTime: slot.endTime || null,
    reason: sameTimetable ? 'overlapping assignment inside this timetable' : 'overlapping assignment in another class',
  }));
}

function timetableConflicts(timetable, input) {
  return getTimetableConflictDetails(timetable, input).length > 0;
}

async function assertSubjectAndFacultyAssignments(classId, days) {
  const subjectIds = [];
  const facultyIds = [];
  for (const day of days) {
    for (const slot of day.slots || []) {
      if (slot.kind === PERIOD_KIND.BREAK) {
        if (slot.subject || slot.faculty) throw ApiError.badRequest('Break periods cannot have subject or Faculty assignments.');
        continue;
      }
      if (!slot.subject || !slot.faculty) throw ApiError.badRequest('Every class period must have both a subject and a Faculty assignment.');
      subjectIds.push(String(slot.subject));
      facultyIds.push(String(slot.faculty));
    }
  }

  const uniqueSubjectIds = [...new Set(subjectIds)];
  const uniqueFacultyIds = [...new Set(facultyIds)];
  const [classDoc, subjects, faculty] = await Promise.all([
    Class.findById(classId).select('_id department').lean(),
    Subject.find({ _id: { $in: uniqueSubjectIds }, class: classId, isActive: true }).select('_id class name code').lean(),
    User.find({ _id: { $in: uniqueFacultyIds }, role: { $in: roleValues(ROLES.ADMIN) }, isActive: true }).select('_id name email employeeId department').lean(),
  ]);
  if (!classDoc) throw ApiError.notFound('Class not found.');
  if (subjects.length !== uniqueSubjectIds.length) throw ApiError.badRequest('Every timetable subject must belong to the selected class and be active.');
  if (faculty.length !== uniqueFacultyIds.length) throw ApiError.badRequest('Every timetable Faculty member must be active.');
  if (faculty.some((member) => !isSameId(member.department, classDoc.department))) throw ApiError.badRequest('Every timetable Faculty member must belong to the selected class department.');
  return { subjects, faculty };
}

async function findFacultyConflicts({ classId, className, days, timetableId, submittedTimetableId = null }) {
  const facultyIds = [...new Set(days.flatMap((day) => (day.slots || []).map((slot) => slot.faculty).filter(Boolean).map(String)))];
  if (!facultyIds.length) return { internalConflicts: [], externalConflicts: [], conflicts: [] };
  const activeTimetableId = normalizedObjectId(timetableId);
  const currentClassId = normalizedObjectId(classId);
  const existingFilter = {
    isActive: true,
    class: currentClassId ? { $ne: currentClassId } : { $ne: classId },
    'days.slots.faculty': { $in: facultyIds },
  };
  if (activeTimetableId) existingFilter._id = { $ne: activeTimetableId };
  if (process.env.DEBUG_TIMETABLE_CONFLICTS === 'true') {
    console.warn('[TIMETABLE_CONFLICT_QUERY]', JSON.stringify({
      classId: String(classId),
      activeTimetableId: activeTimetableId ? String(activeTimetableId) : null,
      submittedTimetableId: submittedTimetableId ? String(submittedTimetableId) : null,
      facultyIds,
      query: {
        isActive: true,
        classNotEqual: currentClassId ? String(currentClassId) : String(classId),
        timetableNotEqual: activeTimetableId ? String(activeTimetableId) : null,
      },
      submittedAssignments: days.flatMap((day) => (day.slots || [])
        .filter((slot) => slot.faculty && slot.kind !== PERIOD_KIND.BREAK)
        .map((slot) => ({
          classId: String(classId),
          activeTimetableId: activeTimetableId ? String(activeTimetableId) : null,
          submittedTimetableId: submittedTimetableId ? String(submittedTimetableId) : null,
          facultyId: String(slot.faculty),
          dayOfWeek: day.dayOfWeek,
          order: Number(slot.order),
          startTime: slot.startTime || null,
          endTime: slot.endTime || null,
          currentSlotId: slot._id ? String(slot._id) : null,
        }))),
    }));
  }
  const existing = await Timetable.find(existingFilter)
    .select('_id class days')
    .populate({ path: 'class', select: '_id name code' })
    .lean();
  const internalConflicts = [];
  const externalConflicts = [];
  const seen = new Set();
  for (const day of days) {
    const slots = day.slots || [];
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = slots[slotIndex];
      if (!slot.faculty || slot.kind === PERIOD_KIND.BREAK) continue;
      for (let otherIndex = slotIndex + 1; otherIndex < slots.length; otherIndex += 1) {
        const other = slots[otherIndex];
        if (!other.faculty || other.kind === PERIOD_KIND.BREAK || !isSameId(other.faculty, slot.faculty) || !slotTimeOverlaps(other, slot)) continue;
        const pairKey = `internal:${String(slot._id || slotIndex)}:${String(other._id || otherIndex)}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        internalConflicts.push({
          facultyId: String(slot.faculty),
          currentClassId: String(classId),
          currentClassName: className || null,
          currentTimetableId: timetableId ? String(timetableId) : null,
          conflictingTimetableId: timetableId ? String(timetableId) : null,
          conflictingClassId: String(classId),
          conflictingClassName: className || null,
          dayOfWeek: day.dayOfWeek,
          order: Number(slot.order),
          currentStartTime: slot.startTime || null,
          currentEndTime: slot.endTime || null,
          conflictingStartTime: other.startTime || null,
          conflictingEndTime: other.endTime || null,
          currentSlotId: slot._id ? String(slot._id) : null,
          conflictingSlotId: other._id ? String(other._id) : null,
          startTime: slot.startTime || null,
          endTime: slot.endTime || null,
          reason: 'overlapping assignment inside this timetable',
        });
      }
      for (const timetable of existing) {
        const details = getTimetableConflictDetails(timetable, {
          dayOfWeek: day.dayOfWeek,
          slot,
          facultyId: slot.faculty,
          classId,
          timetableId,
          currentClassName: className,
        });
        for (const detail of details) {
          const pairKey = `external:${detail.currentSlotId || `${day.dayOfWeek}:${slotIndex}`}:${detail.conflictingTimetableId}:${detail.conflictingSlotId || 'unknown'}`;
          if (!seen.has(pairKey)) {
            seen.add(pairKey);
            externalConflicts.push(detail);
          }
        }
      }
    }
  }
  const conflicts = [...internalConflicts, ...externalConflicts];
  if (process.env.DEBUG_TIMETABLE_CONFLICTS === 'true') {
    const diagnostic = {
      classId: String(classId),
      activeTimetableId: activeTimetableId ? String(activeTimetableId) : null,
      submittedTimetableId: submittedTimetableId ? String(submittedTimetableId) : null,
      internalConflicts,
      externalConflicts,
      firstInternalConflict: internalConflicts[0] || null,
      firstExternalConflict: externalConflicts[0] || null,
      conflictTimetableMatchesActive: [...internalConflicts, ...externalConflicts].map((detail) => ({
        conflictingTimetableId: detail.conflictingTimetableId || null,
        activeTimetableId: activeTimetableId ? String(activeTimetableId) : null,
        sameTimetable: Boolean(activeTimetableId && detail.conflictingTimetableId && String(detail.conflictingTimetableId) === String(activeTimetableId)),
        conflictingClassId: detail.conflictingClassId || null,
        sameClass: Boolean(detail.conflictingClassId && String(detail.conflictingClassId) === String(classId)),
        facultyId: detail.facultyId || null,
        dayOfWeek: detail.dayOfWeek || null,
        order: detail.order || null,
        currentStartTime: detail.currentStartTime || null,
        currentEndTime: detail.currentEndTime || null,
        conflictingStartTime: detail.conflictingStartTime || null,
        conflictingEndTime: detail.conflictingEndTime || null,
        currentSlotId: detail.currentSlotId || null,
        conflictingSlotId: detail.conflictingSlotId || null,
        reason: detail.reason || null,
      })),
    };
    console.warn('[TIMETABLE_CONFLICT_SUMMARY]', JSON.stringify({
      classId: diagnostic.classId,
      activeTimetableId: diagnostic.activeTimetableId,
      internalCount: internalConflicts.length,
      externalCount: externalConflicts.length,
      firstInternalConflict: diagnostic.firstInternalConflict,
      firstExternalConflict: diagnostic.firstExternalConflict,
      conflictTimetableMatchesActive: diagnostic.conflictTimetableMatchesActive,
    }));
  }
  return { internalConflicts, externalConflicts, conflicts };
}

function populateTimetable(query) {
  return query
    .populate({ path: 'class', select: 'name code department semester classTeacher', populate: [
      { path: 'department', select: 'name code' },
      { path: 'semester', select: 'number label' },
      { path: 'classTeacher', select: 'name email employeeId' },
    ] })
    .populate({ path: 'days.slots.subject', select: 'name code class' })
    .populate({ path: 'days.slots.faculty', select: 'name email employeeId department' });
}

export const listTimetables = asyncHandler(async (req, res) => {
  const { department, semester, classId } = req.query;
  let filter = { isActive: true };
  const actorRole = canonicalRole(req.user.role);
  if (classId) {
    await assertClassAccess(req, classId);
    filter.class = classId;
  } else if (actorRole === ROLES.USER) {
    if (!req.user.class) return sendResponse(res, 200, 'No timetable available', { timetables: [] });
    filter.class = req.user.class;
  } else if (actorRole === ROLES.ADMIN) {
    const [subjectClasses, tutorClasses] = await Promise.all([
      Subject.distinct('class', { faculty: req.user._id, isActive: true }),
      Class.distinct('_id', { classTeacher: req.user._id, isActive: true }),
    ]);
    filter.class = { $in: [...new Set([...subjectClasses, ...tutorClasses].map(String))] };
  }
  if (department || semester) {
    const classFilter = { isActive: true, ...(department ? { department } : {}), ...(semester ? { semester } : {}) };
    const classIds = await Class.distinct('_id', classFilter);
    filter.class = filter.class?.$in ? { $in: filter.class.$in.filter((id) => classIds.some((candidate) => String(candidate) === String(id))) } : { $in: classIds };
  }
  const timetables = await populateTimetable(Timetable.find(filter).sort({ updatedAt: -1 }).limit(100));
  return sendResponse(res, 200, 'Timetables fetched', { timetables });
});

export const getTimetable = asyncHandler(async (req, res) => {
  await assertClassAccess(req, req.params.classId);
  const timetable = await populateTimetable(Timetable.findOne({ class: req.params.classId, isActive: true }));
  return sendResponse(res, 200, timetable ? 'Timetable fetched' : 'No class timetable configured', { timetable: timetable || null });
});

export const upsertTimetable = asyncHandler(async (req, res) => {
  const classDoc = await assertClassAccess(req, req.params.classId);
  if (canonicalRole(req.user.role) !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Only an authorized HOD can change class timetables.');
  const { days = [] } = req.body;
  const submittedTimetableId = typeof req.body?.timetableId === 'string' ? req.body.timetableId : null;
  const existing = await Timetable.findOne({ class: classDoc._id, isActive: true }).select('_id').lean();
  if (process.env.DEBUG_TIMETABLE_CONFLICTS === 'true') {
    console.warn('[TIMETABLE_SAVE_IDENTITY]', JSON.stringify({
      requestId: req.id,
      routeClassId: String(classDoc._id),
      existingTimetableId: existing?._id ? String(existing._id) : null,
      submittedTimetableId,
      submittedDays: days.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        slots: (day.slots || []).map((slot) => ({
          slotId: slot._id ? String(slot._id) : null,
          facultyId: slot.faculty ? String(slot.faculty) : null,
          dayOfWeek: day.dayOfWeek,
          order: Number(slot.order),
          startTime: slot.startTime || null,
          endTime: slot.endTime || null,
          kind: slot.kind || null,
        })),
      })),
    }));
  }
  const { faculty } = await assertSubjectAndFacultyAssignments(classDoc._id, days);
  const activeTimetableId = existing?._id || null;
  const conflictResult = await findFacultyConflicts({ classId: classDoc._id, className: classDoc.name, days, timetableId: activeTimetableId, submittedTimetableId });
  const { conflicts } = conflictResult;
  if (conflicts.length) {
    const facultyNames = new Map(faculty.map((member) => [String(member._id), member.name]));
    const details = conflicts.map((conflict) => ({ ...conflict, facultyName: facultyNames.get(String(conflict.facultyId)) || 'Selected Faculty member' }));
    if (process.env.DEBUG_TIMETABLE_CONFLICTS === 'true') {
      console.warn('[TIMETABLE_CONFLICT_DETAILS]', JSON.stringify({
        requestId: req.id,
        requestedClassId: String(classDoc._id),
        requestedTimetableId: activeTimetableId ? String(activeTimetableId) : null,
        submittedTimetableId,
        internalConflictCount: conflictResult.internalConflicts.length,
        externalConflictCount: conflictResult.externalConflicts.length,
        firstInternalConflict: conflictResult.internalConflicts[0] || null,
        firstExternalConflict: conflictResult.externalConflicts[0] || null,
        conflicts: details.slice(0, 200),
      }));
    }
    const first = details[0];
    const time = first.currentStartTime && first.currentEndTime ? ` (${first.currentStartTime}–${first.currentEndTime})` : '';
    const day = first.dayOfWeek[0].toUpperCase() + first.dayOfWeek.slice(1);
    const assignmentKeys = new Set(details.map((detail) => `${detail.currentSlotId || detail.dayOfWeek}:${detail.order}`));
    const assignmentCount = assignmentKeys.size;
    const internalCount = conflictResult.internalConflicts.length;
    const externalCount = conflictResult.externalConflicts.length;
    let message;
    if (internalCount > 0 && externalCount > 0) {
      message = `${internalCount} overlapping assignment${internalCount === 1 ? '' : 's'} inside this timetable and ${externalCount} conflict${externalCount === 1 ? '' : 's'} with other class schedules. Review the highlighted rows.`;
    } else if (internalCount > 0) {
      message = internalCount === 1
        ? `${first.facultyName} is assigned to overlapping periods inside this timetable on ${day}. Choose a different Faculty member or period.`
        : `${internalCount} overlapping Faculty assignments exist inside this timetable. Review the highlighted rows and choose different periods or Faculty members.`;
    } else if (assignmentCount === 1) {
      message = `${first.facultyName} is already occupied on ${day}, Period ${first.order}${time}. Choose another available Faculty member.`;
    } else {
      message = `${externalCount} timetable assignments conflict with existing Faculty schedules. Review the highlighted day, period, Faculty, and time details and choose available Faculty members.`;
    }
    const conflictError = ApiError.conflict(message, details);
    conflictError.code = 'TIMETABLE_CONFLICT';
    throw conflictError;
  }
  const timetable = await Timetable.findOneAndUpdate(
    { class: classDoc._id },
    { $set: { days, isActive: true, updatedBy: req.user._id }, $setOnInsert: { createdBy: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.TIMETABLE_UPDATE, targetType: 'Timetable', targetId: timetable._id, description: `Updated timetable for ${classDoc.name}`, ipAddress: req.ip, requestId: req.id });
  await timetable.populate([
    { path: 'class', select: 'name code department semester classTeacher' },
    { path: 'days.slots.subject', select: 'name code class' },
    { path: 'days.slots.faculty', select: 'name email employeeId' },
  ]);
  return sendResponse(res, 200, 'Class timetable saved successfully', { timetable });
});

export const getAvailableFaculty = asyncHandler(async (req, res) => {
  if (canonicalRole(req.user.role) !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Only an authorized HOD can view Faculty availability.');
  const { classId, subjectId, dayOfWeek, order, startTime, endTime, excludeTimetableId, slotId } = req.query;
  if (!classId || !DAYS_OF_WEEK.includes(dayOfWeek)) throw ApiError.badRequest('classId and a valid dayOfWeek are required.');
  if (subjectId && !/^[a-f\d]{24}$/i.test(String(subjectId))) throw ApiError.badRequest('subjectId must be a valid identifier.');
  if (slotId && !/^[a-f\d]{24}$/i.test(String(slotId))) throw ApiError.badRequest('slotId must be a valid identifier.');
  const classDoc = await assertClassAccess(req, classId);
  if (subjectId) {
    const subject = await Subject.findOne({ _id: subjectId, class: classDoc._id, isActive: true }).select('_id').lean();
    if (!subject) throw ApiError.badRequest('Selected subject does not belong to this active class.');
  }
  const orderNumber = Number(order);
  if (!Number.isInteger(orderNumber) || orderNumber < 1 || orderNumber > 24) throw ApiError.badRequest('A valid period order is required.');
  if ((startTime && !endTime) || (!startTime && endTime) || (startTime && startTime >= endTime)) throw ApiError.badRequest('A valid start and end time pair is required.');

  const [faculty, timetables, currentTimetable] = await Promise.all([
    User.find({ role: { $in: roleValues(ROLES.ADMIN) }, isActive: true, department: classDoc.department }).select('name employeeId department').populate('department', 'name code').sort({ name: 1 }).limit(200).lean(),
    Timetable.find({ isActive: true, 'days.dayOfWeek': dayOfWeek }).select('_id class days').lean(),
    Timetable.findOne({ class: classDoc._id, isActive: true }).select('_id class days').lean(),
  ]);
  const resolvedTimetableId = currentTimetable?._id ? String(currentTimetable._id) : null;
  if (excludeTimetableId && String(excludeTimetableId) !== resolvedTimetableId) {
    if (process.env.DEBUG_TIMETABLE_CONFLICTS === 'true') {
      console.warn('[TIMETABLE_AVAILABILITY_IDENTITY]', JSON.stringify({
        requestId: req.id,
        requestedClassId: String(classDoc._id),
        requestedTimetableId: String(excludeTimetableId),
        resolvedTimetableId,
        requestedSlotId: slotId || null,
      }));
    }
    throw ApiError.badRequest('The selected timetable changed. Reload this class before checking Faculty availability.');
  }
  if (slotId && (!currentTimetable || !(currentTimetable.days || []).some((day) => (day.slots || []).some((slot) => isSameId(slot._id, slotId))))) {
    throw ApiError.badRequest('The selected timetable slot is no longer part of this class. Reload the class before checking Faculty availability.');
  }
  const requestedSlot = { order: orderNumber, startTime: startTime || null, endTime: endTime || null };
  const otherTimetables = timetables.filter((timetable) => !resolvedTimetableId || String(timetable._id) !== resolvedTimetableId);
  const available = faculty.filter((member) => {
    const conflictInput = {
      dayOfWeek,
      slot: requestedSlot,
      facultyId: member._id,
      classId,
      timetableId: resolvedTimetableId,
      slotId: slotId || null,
    };
    const internalConflict = currentTimetable ? timetableConflicts(currentTimetable, conflictInput) : false;
    const externalConflict = otherTimetables.some((timetable) => timetableConflicts(timetable, conflictInput));
    return !internalConflict && !externalConflict;
  });
  const busyFacultyCount = faculty.length - available.length;
  return sendResponse(res, 200, 'Available Faculty fetched', {
    faculty: available,
    availableFaculty: available,
    eligibleFacultyCount: faculty.length,
    busyFacultyCount,
    availableFacultyCount: available.length,
    requestedSlot,
    timetableId: resolvedTimetableId,
    slotId: slotId || null,
    scope: { classId: String(classDoc._id), departmentId: String(classDoc.department), subjectId: subjectId || null },
  });
});
