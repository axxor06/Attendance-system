import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A Subject belongs to one Department + Semester (via its Class) and is
 * taught by one or more Faculty members. Students are not listed directly
 * on the subject - they inherit subjects through their Class - except for
 * elective-style cases where `students` can override the default class
 * roster (left empty = "all students in the class take this subject").
 */
const subjectSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
    },
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
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    faculty: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    students: [
      {
        // optional override roster (e.g. electives). Empty = whole class.
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isElective: {
      type: Boolean,
      default: false,
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

subjectSchema.index({ code: 1, class: 1 }, { unique: true });
subjectSchema.index({ department: 1, semester: 1 });
subjectSchema.index({ faculty: 1 });

const Subject = mongoose.model('Subject', subjectSchema);

export default Subject;
