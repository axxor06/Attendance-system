import mongoose from 'mongoose';
import { ACTIVITY_ACTION } from '../config/constants.js';

const { Schema } = mongoose;

const activityLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, enum: Object.values(ACTIVITY_ACTION), required: true },
    targetType: { type: String, default: null },
    targetId: { type: Schema.Types.ObjectId, default: null },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    ipAddress: { type: String, maxlength: 100, default: null },
    userAgent: { type: String, maxlength: 500, default: null },
    reason: { type: String, maxlength: 500, default: null },
    requestId: { type: String, maxlength: 128, default: null },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

activityLogSchema.index({ actor: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
