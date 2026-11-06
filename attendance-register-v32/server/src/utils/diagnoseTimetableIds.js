import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Class, Timetable } from '../models/index.js';
import { inspectTimetableSlotIds } from './timetableConflictUtils.js';

dotenv.config();

const timeoutMs = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000);

function parseIds() {
  const raw = process.env.DIAGNOSTIC_TIMETABLE_IDS || `${process.env.TIMETABLE_ID_A || ''},${process.env.TIMETABLE_ID_B || ''}`;
  const ids = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))];
  if (ids.length < 2) throw new Error('Set DIAGNOSTIC_TIMETABLE_IDS to two comma-separated Mongo IDs, or set TIMETABLE_ID_A and TIMETABLE_ID_B.');
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new Error('Every diagnostic timetable ID must be a valid Mongo ObjectId.');
  return ids;
}

function summarizeTimetable(timetable) {
  const slotIdIntegrity = inspectTimetableSlotIds([timetable]);
  return {
    _id: String(timetable._id),
    classId: timetable.class?._id ? String(timetable.class._id) : timetable.class ? String(timetable.class) : null,
    className: timetable.class?.name || null,
    classCode: timetable.class?.code || null,
    department: timetable.class?.department?.name || (timetable.class?.department ? String(timetable.class.department) : null),
    departmentId: timetable.class?.department?._id ? String(timetable.class.department._id) : null,
    isActive: timetable.isActive,
    numberOfDays: (timetable.days || []).length,
    numberOfSlots: slotIdIntegrity.totalSlots,
    persistedSlotIds: Object.fromEntries((timetable.days || []).map((day) => [day.dayOfWeek, (day.slots || []).map((slot) => slot?._id ? String(slot._id) : null)])),
    missingSlotIdCount: slotIdIntegrity.missingSlotIds.length,
    invalidSlotIdCount: slotIdIntegrity.invalidSlotIds.length,
    duplicateSlotIdCount: slotIdIntegrity.duplicateSlotIds.length,
  };
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  const ids = parseIds();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: timeoutMs, connectTimeoutMS: timeoutMs });
  const [timetables, classes, classTimetables] = await Promise.all([
    Timetable.find({ _id: { $in: ids } }).select('_id class isActive days').populate({ path: 'class', select: '_id name code department', populate: { path: 'department', select: '_id name code' } }).lean(),
    Class.find({ _id: { $in: ids } }).select('_id name code department isActive').populate('department', 'name code').lean(),
    Timetable.find({ class: { $in: ids }, isActive: true }).select('_id class isActive days').lean(),
  ]);
  const timetableById = new Map(timetables.map((item) => [String(item._id), item]));
  const classById = new Map(classes.map((item) => [String(item._id), item]));
  for (const id of ids) {
    const timetable = timetableById.get(id);
    const classDoc = classById.get(id);
    console.log(JSON.stringify({
      suppliedId: id,
      asTimetable: timetable ? summarizeTimetable(timetable) : null,
      asClass: classDoc ? { _id: String(classDoc._id), name: classDoc.name, code: classDoc.code, department: classDoc.department?.name || null, isActive: classDoc.isActive } : null,
      activeTimetableForClass: classTimetables.filter((item) => String(item.class) === id).map((item) => ({ ...summarizeTimetable(item), classId: String(item.class) })),
      interpretation: timetable ? 'persisted timetable identifier' : classDoc ? 'class identifier used by GET/PUT /api/timetables/:classId' : 'no active timetable or class matched this ID',
    }));
  }
}

try {
  await run();
} catch (error) {
  console.error(`Timetable ID diagnosis failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
