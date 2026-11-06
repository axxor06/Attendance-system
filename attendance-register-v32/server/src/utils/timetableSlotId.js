import mongoose from 'mongoose';
import { createHash } from 'node:crypto';

export function stableTimetableSlotId(classId, dayOfWeek, order) {
  const seed = `attendance-register:timetable-slot:${String(classId)}:${dayOfWeek}:${Number(order)}`;
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}
