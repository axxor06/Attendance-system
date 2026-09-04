import mongoose from 'mongoose';
import { ATTENDANCE_STATUS_LIST } from '../config/constants.js';

const { Schema } = mongoose;

/**
 * One Attendance document = one student's status for one subject's
 * session in one period on one date. This is intentionally granular
 * (rather than one doc per "session" with an array of students) because:
 *   - It lets a student's attendance be queried directly with a simple
 *     filter (studentId + date range) without unwinding arrays.
 *   - Percentage aggregation pipelines stay simple ($match + $group).
 *   - Editing a single student's entry for "today" never risks touching
 *     other students' rows in the same write.
 *
 * The compound unique index guarantees that the same student cannot be
 * marked twice for the same subject+period+date, which is exactly the
 * "Chemistry in period 2, Biology in period 5, independently" rule
 * described in the spec - each (subject, period, date) triple is its
 * own independent attendance universe per student.
 */
const attendanceSchema = new Schema(
  {
    date: {
      // stored at UTC midnight for the calendar day this record belongs to
      type: Date,
      required: true,
    },
    dayOfWeek: {
      type: String,
      required: true,
    },
    periodOrder: {
      // references PeriodTemplate.periods[].order for that dayOfWeek
      type: Number,
      required: true,
    },
    periodName: {
      // denormalized snapshot of the period's name at the time of marking,
      // so renaming a period later doesn't rewrite history
      type: String,
      required: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    faculty: {
      // who marked this entry
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUS_LIST,
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    editedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Guarantees independent, non-duplicate records per student/subject/period/date.
attendanceSchema.index(
  { student: 1, subject: 1, date: 1, periodOrder: 1 },
  { unique: true }
);

// Common query patterns: faculty pulling a session's roster, percentage rollups.
attendanceSchema.index({ subject: 1, date: 1, periodOrder: 1 });
attendanceSchema.index({ student: 1, date: 1 });
attendanceSchema.index({ class: 1, date: 1 });
attendanceSchema.index({ faculty: 1, date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
