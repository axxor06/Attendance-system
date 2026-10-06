import mongoose from 'mongoose';
import { DAYS_OF_WEEK, PERIOD_KIND } from '../config/constants.js';

const { Schema } = mongoose;

/**
 * A single period slot within a day's template.
 * `order` is the position in the day (1-indexed) and is what attendance
 * records reference - NOT the array index - so re-ordering/renaming
 * later doesn't silently corrupt historical attendance.
 */
const periodSlotSchema = new Schema(
  {
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    name: {
      // e.g. "Period 1", "Assembly", "Lunch", "Lab"
      type: String,
      required: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: Object.values(PERIOD_KIND),
      default: PERIOD_KIND.CLASS,
    },
    startTime: {
      // "HH:mm" 24-hour, optional display-only field
      type: String,
      default: null,
    },
    endTime: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

/**
 * One PeriodTemplate document per day-of-week. The HOD configures how
 * many periods exist on each day, and can give each one a custom name
 * and mark it as a class period or a break (assembly/lunch/free).
 * Attendance can only be marked for `kind: 'class'` slots.
 *
 * Only one *active* template may exist per day at a time (enforced in
 * the service layer, not a unique index, because we keep historical
 * templates around for record-keeping if the HOD changes the schedule
 * mid-semester).
 */
const periodTemplateSchema = new Schema(
  {
    dayOfWeek: {
      type: String,
      enum: DAYS_OF_WEEK,
      required: true,
    },
    periods: {
      type: [periodSlotSchema],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'A period template must contain at least one period.',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Historical inactive templates remain queryable, but the database must prevent
// two concurrent requests from leaving multiple active templates for one day.
periodTemplateSchema.index(
  { dayOfWeek: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'unique_active_template_per_day' }
);

// Keep `order` values unique within a single template before saving.
periodTemplateSchema.pre('validate', function checkUniqueOrders(next) {
  const orders = this.periods.map((p) => p.order);
  const unique = new Set(orders);
  if (unique.size !== orders.length) {
    return next(new Error('Period `order` values must be unique within a day.'));
  }
  next();
});

const PeriodTemplate = mongoose.model('PeriodTemplate', periodTemplateSchema);

export default PeriodTemplate;
