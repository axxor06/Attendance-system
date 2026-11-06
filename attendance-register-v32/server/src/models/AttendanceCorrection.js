import mongoose from 'mongoose';
import { ATTENDANCE_STATUS_LIST, CORRECTION_SOURCE } from '../config/constants.js';

const { Schema } = mongoose;

/**
 * Append-only audit trail for every change to an existing attendance status.
 * Rows are never updated or deleted by the application; a later correction of
 * the same attendance record adds another row, so the full history survives.
 *
 * Context fields (class, subject, date, periodOrder) are denormalised on
 * purpose: they let HOD review queries filter and sort without joining the
 * attendance collection, and they keep the trail readable even if the
 * attendance record or its subject is later removed.
 */
const attendanceCorrectionSchema = new Schema(
  {
    attendance: { type: Schema.Types.ObjectId, ref: 'Attendance', required: true, immutable: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true, immutable: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, immutable: true },
    date: { type: Date, required: true, immutable: true },
    periodOrder: { type: Number, required: true, immutable: true },
    periodName: { type: String, default: '', immutable: true },
    // null means the correction created the record (the student had not been marked).
    previousStatus: { type: String, enum: [...ATTENDANCE_STATUS_LIST, null], default: null, immutable: true },
    newStatus: { type: String, enum: ATTENDANCE_STATUS_LIST, required: true, immutable: true },
    correctedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    reason: { type: String, trim: true, maxlength: 300, default: '', immutable: true },
    source: { type: String, enum: Object.values(CORRECTION_SOURCE), default: CORRECTION_SOURCE.CORRECTION, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

attendanceCorrectionSchema.index({ attendance: 1, createdAt: -1 });
attendanceCorrectionSchema.index({ correctedBy: 1, createdAt: -1 });
attendanceCorrectionSchema.index({ class: 1, createdAt: -1 });
attendanceCorrectionSchema.index({ subject: 1, createdAt: -1 });
attendanceCorrectionSchema.index({ student: 1, createdAt: -1 });
attendanceCorrectionSchema.index({ createdAt: -1 });

const AttendanceCorrection = mongoose.model('AttendanceCorrection', attendanceCorrectionSchema);
export default AttendanceCorrection;
