import mongoose from 'mongoose';

const { Schema } = mongoose;

const semesterSchema = new Schema(
  {
    number: {
      // e.g. 1, 2, 3 ... 8
      type: Number,
      required: [true, 'Semester number is required'],
      min: 1,
      max: 12,
    },
    label: {
      // e.g. "Semester 3" - auto-derivable but stored for flexibility/display
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isActive: {
      // currently running semester
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

// Semester numbers are institution-wide identifiers; the database must enforce
// uniqueness in addition to the controller pre-check to close concurrent-create races.
semesterSchema.index({ number: 1 }, { unique: true, name: 'unique_semester_number' });

semesterSchema.pre('validate', function setLabel(next) {
  if (!this.label && this.number) {
    this.label = `Semester ${this.number}`;
  }
  next();
});

const Semester = mongoose.model('Semester', semesterSchema);

export default Semester;
