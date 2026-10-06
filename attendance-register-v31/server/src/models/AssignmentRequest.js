import mongoose from 'mongoose';
import { ASSIGNMENT_REQUEST_STATUS, ASSIGNMENT_REQUEST_STATUS_LIST, DAYS_OF_WEEK } from '../config/constants.js';

const { Schema } = mongoose;

const assignmentRequestSchema = new Schema(
  {
    timetable: { type: Schema.Types.ObjectId, ref: 'Timetable', required: true, immutable: true },
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true, immutable: true },
    dayOfWeek: { type: String, enum: DAYS_OF_WEEK, required: true, immutable: true },
    slotId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    order: { type: Number, required: true, min: 1, max: 24, immutable: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, immutable: true },
    faculty: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000, immutable: true },
    status: { type: String, enum: ASSIGNMENT_REQUEST_STATUS_LIST, default: ASSIGNMENT_REQUEST_STATUS.PENDING },
    decisionReason: { type: String, trim: true, maxlength: 1000, default: null },
    replacementFaculty: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

assignmentRequestSchema.index(
  { timetable: 1, slotId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: ASSIGNMENT_REQUEST_STATUS.PENDING }, name: 'one_pending_assignment_request_per_slot' },
);
assignmentRequestSchema.index({ faculty: 1, status: 1, createdAt: -1 });
assignmentRequestSchema.index({ class: 1, status: 1, createdAt: -1 });
assignmentRequestSchema.index({ status: 1, createdAt: -1 });

assignmentRequestSchema.pre('validate', function validateDecision(next) {
  if (this.status === ASSIGNMENT_REQUEST_STATUS.PENDING && (this.decidedBy || this.decidedAt || this.decisionReason || this.replacementFaculty)) {
    return next(new Error('Pending assignment requests cannot contain decision metadata.'));
  }
  if (this.status === ASSIGNMENT_REQUEST_STATUS.REJECTED) {
    if (!this.decisionReason?.trim()) return next(new Error('A rejection reason is required.'));
    if (this.replacementFaculty) return next(new Error('Rejected assignment requests cannot contain a replacement Faculty member.'));
  }
  if (this.status === ASSIGNMENT_REQUEST_STATUS.ACCEPTED && !this.replacementFaculty) {
    return next(new Error('Accepted assignment requests require a replacement Faculty member.'));
  }
  if (this.status !== ASSIGNMENT_REQUEST_STATUS.PENDING && (!this.decidedBy || !this.decidedAt)) {
    return next(new Error('Decided assignment requests require decision metadata.'));
  }
  next();
});

const AssignmentRequest = mongoose.model('AssignmentRequest', assignmentRequestSchema);

export default AssignmentRequest;
