import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Class, Timetable, User } from '../models/index.js';
import { validateTimetableDocuments } from './timetableConflictUtils.js';

dotenv.config();

const timeoutMs = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000);

function printConflict(conflict, index) {
  console.log(JSON.stringify({
    conflict: index + 1,
    facultyId: conflict.facultyId,
    facultyName: conflict.facultyName,
    currentClassId: conflict.currentClassId,
    currentClassName: conflict.currentClassName,
    currentTimetableId: conflict.currentTimetableId,
    conflictingTimetableId: conflict.conflictingTimetableId,
    conflictingClassId: conflict.conflictingClassId,
    conflictingClassName: conflict.conflictingClassName,
    dayOfWeek: conflict.dayOfWeek,
    currentOrder: conflict.currentOrder,
    conflictingOrder: conflict.conflictingOrder,
    currentStartTime: conflict.currentStartTime,
    currentEndTime: conflict.currentEndTime,
    conflictingStartTime: conflict.conflictingStartTime,
    conflictingEndTime: conflict.conflictingEndTime,
    currentSlotId: conflict.currentSlotId,
    conflictingSlotId: conflict.conflictingSlotId,
    reason: conflict.reason,
  }));
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: timeoutMs, connectTimeoutMS: timeoutMs });

  const [timetables, classes, faculty] = await Promise.all([
    Timetable.find({ isActive: true }).select('_id class days').lean(),
    Class.find({ isActive: true }).select('_id name code department').lean(),
    User.find({ isActive: true, role: 'admin' }).select('_id name employeeId department').lean(),
  ]);
  const classById = new Map(classes.map((item) => [String(item._id), item]));
  const facultyById = new Map(faculty.map((item) => [String(item._id), item]));
  const result = validateTimetableDocuments(timetables, { classById, facultyById });

  console.log(`Total active timetables: ${timetables.length}`);
  console.log(`Total Faculty assignments: ${result.assignments.length}`);
  console.log(`Actual overlapping assignments: ${result.conflicts.length}`);
  console.log(`Conflicts by Faculty: ${JSON.stringify(result.summary.conflictsByFaculty)}`);
  console.log(`Conflicts by department: ${JSON.stringify(result.summary.conflictsByDepartment)}`);
  console.log(`Conflicts by day: ${JSON.stringify(result.summary.conflictsByDay)}`);
  console.log(`Conflicts by period: ${JSON.stringify(result.summary.conflictsByPeriod)}`);
  console.log(`Total timetable slots: ${result.slotIdIntegrity.totalSlots}`);
  console.log(`Valid slot IDs: ${result.slotIdIntegrity.validSlotIds}`);
  console.log(`Missing slot IDs: ${result.slotIdIntegrity.missingSlotIds.length}`);
  console.log(`Invalid slot IDs: ${result.slotIdIntegrity.invalidSlotIds.length}`);
  console.log(`Duplicate slot IDs: ${result.slotIdIntegrity.duplicateSlotIds.length}`);

  if (result.conflicts.length > 0) {
    console.log('Exact conflicts:');
    result.conflicts.forEach(printConflict);
    throw new Error(`Timetable validation failed with ${result.conflicts.length} actual overlapping assignment pair(s).`);
  }

  if (!result.slotIdIntegrity.ok) {
    const examples = [
      ...result.slotIdIntegrity.missingSlotIds.map((item) => ({ type: 'missing', ...item })),
      ...result.slotIdIntegrity.invalidSlotIds.map((item) => ({ type: 'invalid', ...item })),
      ...result.slotIdIntegrity.duplicateSlotIds.map((item) => ({ type: 'duplicate', ...item })),
    ].slice(0, 20);
    console.log(`Slot-ID integrity examples: ${JSON.stringify(examples)}`);
    throw new Error('Timetable validation failed because one or more raw timetable slots do not have a unique Mongo ObjectId.');
  }

  console.log('Timetable validation passed: zero unintended Faculty overlaps found and every raw slot has a unique Mongo ObjectId.');
}

try {
  await run();
} catch (error) {
  console.error(`Timetable validation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
