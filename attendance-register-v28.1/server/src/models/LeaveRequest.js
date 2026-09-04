import mongoose from 'mongoose';
import { LEAVE_STATUS, LEAVE_STATUS_LIST } from '../config/constants.js';

const { Schema } = mongoose;

const leaveRequestSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true, immutable: true },
    tutor: { type: Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
    status: { type: String, enum: LEAVE_STATUS_LIST, default: LEAVE_STATUS.PENDING },
    decisionReason: { type: String, trim: true, maxlength: 1000, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

leaveRequestSchema.index({ student: 1, createdAt: -1 });
leaveRequestSchema.index({ class: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ tutor: 1, status: 1, createdAt: -1 });

leaveRequestSchema.pre('validate', function validateDecision(next) {
  if (this.status === LEAVE_STATUS.REJECTED && !this.decisionReason?.trim()) {
    return next(new Error('A rejection reason is required.'));
  }
  if (this.status === LEAVE_STATUS.PENDING && (this.decidedBy || this.decidedAt || this.decisionReason)) {
    return next(new Error('Pending leave requests cannot contain decision metadata.'));
  }
  next();
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
