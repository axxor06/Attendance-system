import mongoose from 'mongoose';

const { Schema } = mongoose;

const departmentSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      unique: true,
    },
    code: {
      // e.g. "CSE", "ECE" - used in class codes like CSE-SEM3
      type: String,
      required: [true, 'Department code is required'],
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: 10,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    programLevel: {
      type: String,
      enum: ['certificate', 'diploma', 'degree', 'postgraduate', 'other'],
      default: 'degree',
    },
    semesterCount: {
      type: Number,
      min: 1,
      max: 20,
      default() { return this.programLevel === 'diploma' ? 6 : 8; },
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

const Department = mongoose.model('Department', departmentSchema);

export default Department;
