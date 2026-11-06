function asId(value) {
  if (value && typeof value === 'object' && value._id) return String(value._id);
  return value === null || value === undefined ? null : String(value);
}

export function isValidMongoObjectId(value) {
  return /^[0-9a-f]{24}$/i.test(asId(value) || '');
}

export function inspectTimetableSlotIds(timetables) {
  const missingSlotIds = [];
  const invalidSlotIds = [];
  const duplicateSlotIds = [];
  const seen = new Map();
  let totalSlots = 0;

  for (const timetable of timetables || []) {
    const timetableId = asId(timetable?._id);
    const classId = asId(timetable?.class);
    for (const day of timetable?.days || []) {
      for (const slot of day?.slots || []) {
        totalSlots += 1;
        const slotId = asId(slot?._id);
        const location = {
          timetableId,
          classId,
          dayOfWeek: day?.dayOfWeek || null,
          order: Number(slot?.order),
        };

        if (!slotId) {
          missingSlotIds.push(location);
          continue;
        }
        if (!isValidMongoObjectId(slotId)) {
          invalidSlotIds.push({ ...location, slotId });
          continue;
        }
        if (seen.has(slotId)) {
          duplicateSlotIds.push({ ...location, slotId, firstSeenAt: seen.get(slotId) });
        } else {
          seen.set(slotId, location);
        }
      }
    }
  }

  return {
    ok: missingSlotIds.length === 0 && invalidSlotIds.length === 0 && duplicateSlotIds.length === 0,
    totalSlots,
    validSlotIds: totalSlots - missingSlotIds.length - invalidSlotIds.length,
    missingSlotIds,
    invalidSlotIds,
    duplicateSlotIds,
  };
}

export function slotTimeOverlaps(left, right) {
  if (left?.startTime && left?.endTime && right?.startTime && right?.endTime) {
    return left.startTime < right.endTime && right.startTime < left.endTime;
  }
  return Number(left?.order) === Number(right?.order);
}

export function collectFacultyAssignments(timetables, { classById = new Map(), facultyById = new Map() } = {}) {
  const assignments = [];
  for (const timetable of timetables || []) {
    const timetableId = asId(timetable?._id);
    const classId = asId(timetable?.class);
    const classDoc = classById.get(classId) || (timetable?.class && typeof timetable.class === 'object' ? timetable.class : null);
    for (const day of timetable?.days || []) {
      for (const slot of day?.slots || []) {
        if (!slot?.faculty || slot.kind === 'break') continue;
        const facultyId = asId(slot.faculty);
        const facultyDoc = facultyById.get(facultyId) || (slot.faculty && typeof slot.faculty === 'object' ? slot.faculty : null);
        assignments.push({
          facultyId,
          facultyName: facultyDoc?.name || null,
          facultyEmployeeId: facultyDoc?.employeeId || null,
          facultyDepartmentId: asId(facultyDoc?.department),
          timetableId,
          classId,
          className: classDoc?.name || null,
          classCode: classDoc?.code || null,
          classDepartmentId: asId(classDoc?.department),
          dayOfWeek: day.dayOfWeek,
          order: Number(slot.order),
          startTime: slot.startTime || null,
          endTime: slot.endTime || null,
          slotId: asId(slot._id),
        });
      }
    }
  }
  return assignments;
}

export function detectFacultyOverlaps(assignments) {
  const buckets = new Map();
  for (const assignment of assignments || []) {
    if (!assignment.facultyId || !assignment.dayOfWeek) continue;
    const key = `${assignment.facultyId}|${assignment.dayOfWeek}`;
    const bucket = buckets.get(key) || [];
    bucket.push(assignment);
    buckets.set(key, bucket);
  }

  const conflicts = [];
  for (const bucket of buckets.values()) {
    bucket.sort((left, right) => (left.startTime || '').localeCompare(right.startTime || '') || left.order - right.order || String(left.slotId || '').localeCompare(String(right.slotId || '')));
    for (let leftIndex = 0; leftIndex < bucket.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bucket.length; rightIndex += 1) {
        const left = bucket[leftIndex];
        const right = bucket[rightIndex];
        if (left.timetableId === right.timetableId && left.slotId === right.slotId) continue;
        if (!slotTimeOverlaps(left, right)) continue;
        conflicts.push({
          facultyId: left.facultyId,
          facultyName: left.facultyName || right.facultyName || null,
          currentClassId: left.classId,
          currentClassName: left.className,
          currentClassCode: left.classCode ?? null,
          currentClassDepartmentId: left.classDepartmentId ?? null,
          currentTimetableId: left.timetableId,
          conflictingClassId: right.classId,
          conflictingClassName: right.className,
          conflictingClassCode: right.classCode ?? null,
          conflictingClassDepartmentId: right.classDepartmentId ?? null,
          conflictingTimetableId: right.timetableId,
          dayOfWeek: left.dayOfWeek,
          currentOrder: left.order,
          order: left.order,
          currentStartTime: left.startTime,
          currentEndTime: left.endTime,
          conflictingOrder: right.order,
          conflictingStartTime: right.startTime,
          conflictingEndTime: right.endTime,
          currentSlotId: left.slotId,
          conflictingSlotId: right.slotId,
          reason: left.timetableId === right.timetableId ? 'overlapping assignment inside the same timetable' : 'overlapping assignment across timetables',
        });
      }
    }
  }
  return conflicts;
}

export function summarizeFacultyConflicts(conflicts) {
  const by = (key) => Object.entries((conflicts || []).reduce((result, conflict) => {
    const group = conflict[key] || 'unknown';
    result[group] = (result[group] || 0) + 1;
    return result;
  }, {})).map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  return {
    totalActualConflicts: conflicts?.length || 0,
    conflictsByFaculty: by('facultyName'),
    conflictsByDepartment: by('currentClassDepartmentId'),
    conflictsByDay: by('dayOfWeek'),
    conflictsByPeriod: by('order'),
  };
}

export function validateTimetableDocuments(timetables, options = {}) {
  const assignments = collectFacultyAssignments(timetables, options);
  const conflicts = detectFacultyOverlaps(assignments);
  return {
    assignments,
    conflicts,
    slotIdIntegrity: inspectTimetableSlotIds(timetables),
    summary: summarizeFacultyConflicts(conflicts),
  };
}
