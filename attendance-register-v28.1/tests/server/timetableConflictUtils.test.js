import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFacultyOverlaps, inspectTimetableSlotIds, validateTimetableDocuments } from '../../server/src/utils/timetableConflictUtils.js';
import { stableTimetableSlotId } from '../../server/src/utils/timetableSlotId.js';
import { getTimetableConflictDetails } from '../../server/src/controllers/timetableController.js';

test('hypothetical availability compares persisted candidate Faculty, not requested-slot Faculty', () => {
  const facultyId = '507f1f77bcf86cd799439021';
  const currentClassId = '507f1f77bcf86cd799439011';
  const currentTimetableId = '507f1f77bcf86cd799439012';
  const details = getTimetableConflictDetails({
    _id: '507f1f77bcf86cd799439099',
    class: { _id: '507f1f77bcf86cd799439099', name: 'Other Class' },
    days: [{ dayOfWeek: 'monday', slots: [{ _id: '507f1f77bcf86cd799439098', order: 1, startTime: '08:00', endTime: '08:55', faculty: facultyId, kind: 'class' }] }],
  }, {
    dayOfWeek: 'monday',
    slot: { order: 1, startTime: '08:00', endTime: '08:55' },
    facultyId,
    classId: currentClassId,
    timetableId: currentTimetableId,
  });
  assert.equal(details.length, 1);
  assert.equal(details[0].facultyId, facultyId);
  assert.equal(details[0].reason, 'overlapping assignment in another class');
});

test('availability detects an internal overlap for a new slot but excludes the exact edited slot', () => {
  const facultyId = '507f1f77bcf86cd799439021';
  const classId = '507f1f77bcf86cd799439011';
  const timetableId = '507f1f77bcf86cd799439012';
  const timetable = {
    _id: timetableId,
    class: { _id: classId, name: 'CSE Semester 1' },
    days: [{ dayOfWeek: 'monday', slots: [{ _id: '507f1f77bcf86cd799439098', order: 1, startTime: '08:00', endTime: '08:55', faculty: facultyId, kind: 'class' }] }],
  };
  const newSlotConflict = getTimetableConflictDetails(timetable, {
    dayOfWeek: 'monday', slot: { order: 2, startTime: '08:30', endTime: '09:25' }, facultyId, classId, timetableId,
  });
  assert.equal(newSlotConflict.length, 1);
  assert.equal(newSlotConflict[0].reason, 'overlapping assignment inside this timetable');
  const editedSlotExclusion = getTimetableConflictDetails(timetable, {
    dayOfWeek: 'monday', slot: { order: 1, startTime: '08:00', endTime: '08:55' }, facultyId, classId, timetableId, slotId: '507f1f77bcf86cd799439098',
  });
  assert.deepEqual(editedSlotExclusion, []);
});

test('Faculty assignments on adjacent periods or different days do not conflict', () => {
  const assignments = [
    { facultyId: 'faculty-1', facultyName: 'Faculty A', timetableId: 't1', classId: 'c1', dayOfWeek: 'monday', order: 1, startTime: '08:00', endTime: '08:55', slotId: 's1' },
    { facultyId: 'faculty-1', facultyName: 'Faculty A', timetableId: 't2', classId: 'c2', dayOfWeek: 'monday', order: 2, startTime: '09:00', endTime: '09:55', slotId: 's2' },
    { facultyId: 'faculty-1', facultyName: 'Faculty A', timetableId: 't3', classId: 'c3', dayOfWeek: 'tuesday', order: 1, startTime: '08:00', endTime: '08:55', slotId: 's3' },
  ];
  assert.deepEqual(detectFacultyOverlaps(assignments), []);
});

test('Faculty assignments with overlapping times produce exact conflict details', () => {
  const conflicts = detectFacultyOverlaps([
    { facultyId: 'faculty-1', facultyName: 'Faculty A', timetableId: 't1', classId: 'c1', className: 'CSE Semester 1', classDepartmentId: 'd1', dayOfWeek: 'monday', order: 1, startTime: '08:00', endTime: '08:55', slotId: 's1' },
    { facultyId: 'faculty-1', facultyName: 'Faculty A', timetableId: 't2', classId: 'c2', className: 'EEE Semester 1', classDepartmentId: 'd2', dayOfWeek: 'monday', order: 1, startTime: '08:30', endTime: '09:10', slotId: 's2' },
  ]);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0], {
    facultyId: 'faculty-1', facultyName: 'Faculty A', currentClassId: 'c1', currentClassName: 'CSE Semester 1', currentClassCode: null, currentClassDepartmentId: 'd1', currentTimetableId: 't1',
    conflictingClassId: 'c2', conflictingClassName: 'EEE Semester 1', conflictingClassCode: null, conflictingClassDepartmentId: 'd2', conflictingTimetableId: 't2', dayOfWeek: 'monday', currentOrder: 1, order: 1,
    currentStartTime: '08:00', currentEndTime: '08:55', conflictingOrder: 1, conflictingStartTime: '08:30', conflictingEndTime: '09:10', currentSlotId: 's1', conflictingSlotId: 's2', reason: 'overlapping assignment across timetables',
  });
});

test('raw timetable slot integrity accepts unique Mongo ObjectIds and rejects missing or duplicate IDs', () => {
  const classId = '507f1f77bcf86cd799439011';
  const first = stableTimetableSlotId(classId, 'monday', 1);
  const second = stableTimetableSlotId(classId, 'monday', 2);
  const valid = inspectTimetableSlotIds([{ _id: '507f1f77bcf86cd799439012', class: classId, days: [{ dayOfWeek: 'monday', slots: [{ _id: first, order: 1 }, { _id: second, order: 2 }] }] }]);
  assert.equal(valid.ok, true);
  assert.equal(valid.totalSlots, 2);
  assert.equal(valid.validSlotIds, 2);

  const invalid = inspectTimetableSlotIds([{ _id: '507f1f77bcf86cd799439013', class: classId, days: [{ dayOfWeek: 'monday', slots: [{ order: 1 }, { _id: first, order: 2 }, { _id: first, order: 3 }] }] }]);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.missingSlotIds.length, 1);
  assert.equal(invalid.duplicateSlotIds.length, 1);
});

test('stable timetable slot IDs remain unchanged for a class/day/order coordinate', () => {
  const first = String(stableTimetableSlotId('507f1f77bcf86cd799439011', 'monday', 1));
  const repeated = String(stableTimetableSlotId('507f1f77bcf86cd799439011', 'monday', 1));
  const differentCoordinate = String(stableTimetableSlotId('507f1f77bcf86cd799439011', 'monday', 2));
  assert.match(first, /^[0-9a-f]{24}$/i);
  assert.equal(repeated, first);
  assert.notEqual(differentCoordinate, first);
});

test('null Faculty break/free slots are not counted as assignments or conflicts', () => {
  const result = validateTimetableDocuments([
    { _id: 't1', class: { _id: 'c1', name: 'CSE Semester 1', department: 'd1' }, days: [{ dayOfWeek: 'monday', slots: [{ _id: 'break-1', order: 2, kind: 'break', startTime: '09:00', endTime: '09:55', faculty: null, subject: null }] }] },
    { _id: 't2', class: { _id: 'c2', name: 'EEE Semester 1', department: 'd2' }, days: [{ dayOfWeek: 'monday', slots: [{ _id: 'slot-2', order: 2, kind: 'class', startTime: '09:00', endTime: '09:55', faculty: { _id: 'faculty-1', name: 'Faculty A' }, subject: 'subject-1' }] }] },
  ]);
  assert.equal(result.assignments.length, 1);
  assert.equal(result.conflicts.length, 0);
});
