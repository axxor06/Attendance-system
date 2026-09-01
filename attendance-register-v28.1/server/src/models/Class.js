import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A Class represents exactly one Department + Semester combination
 * (no divisions/sections), e.g. "CSE - Semester 3".
 * The unique index on (department, semester) enforces "one class per
 * dept+semester" at the database level.
 */
const classSchema = new Schema(
  {
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    semester: {
      type: Schema.Types.ObjectId,
      ref: 'Semester',
      required: true,
    },
    name: {
      // denormalized display name, e.g. "CSE - Semester 3", auto-generated
      type: String,
      trim: true,
    },
    code: {
      // denormalized short code, e.g. "CSE-SEM3", auto-generated
      type: String,
      trim: true,
      uppercase: true,
    },
    classTeacher: {
      // optional faculty advisor for the class
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

classSchema.index({ department: 1, semester: 1 }, { unique: true });

const Class = mongoose.model('Class', classSchema);

export default Class;
