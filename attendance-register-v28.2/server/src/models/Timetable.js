import mongoose from 'mongoose';
import { DAYS_OF_WEEK, PERIOD_KIND } from '../config/constants.js';

const { Schema } = mongoose;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const timetableSlotSchema = new Schema(
  {
    order: { type: Number, required: true, min: 1, max: 24 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    kind: { type: String, enum: Object.values(PERIOD_KIND), default: PERIOD_KIND.CLASS },
    startTime: { type: String, default: null, match: timePattern },
    endTime: { type: String, default: null, match: timePattern },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', default: null },
    faculty: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, trim: true, maxlength: 240, default: null },
  },
  { _id: true },
);

const timetableDaySchema = new Schema(
  {
    dayOfWeek: { type: String, enum: DAYS_OF_WEEK, required: true },
    slots: { type: [timetableSlotSchema], default: [] },
  },
  { _id: false },
);

const timetableSchema = new Schema(
  {
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true, unique: true },
    days: { type: [timetableDaySchema], default: [] },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

timetableSchema.index({ class: 1 }, { unique: true, name: 'unique_timetable_per_class' });

timetableSchema.pre('validate', function validateTimetable(next) {
  const daysSeen = new Set();
  for (const day of this.days || []) {
    if (daysSeen.has(day.dayOfWeek)) return next(new Error('A timetable can contain each day only once.'));
    daysSeen.add(day.dayOfWeek);
    const orders = new Set();
    for (const slot of day.slots || []) {
      if (orders.has(slot.order)) return next(new Error(`Period order ${slot.order} is duplicated on ${day.dayOfWeek}.`));
      orders.add(slot.order);
      if ((slot.startTime && !slot.endTime) || (!slot.startTime && slot.endTime)) {
        return next(new Error('A period must have both start and end times, or neither.'));
      }
      if (slot.startTime && slot.endTime && slot.startTime >= slot.endTime) {
        return next(new Error('A period end time must be after its start time.'));
      }
      if (slot.kind === PERIOD_KIND.BREAK && (slot.subject || slot.faculty)) {
        return next(new Error('Break periods cannot have a subject or faculty assignment.'));
      }
    }
  }
  next();
});

const Timetable = mongoose.model('Timetable', timetableSchema);

export default Timetable;
