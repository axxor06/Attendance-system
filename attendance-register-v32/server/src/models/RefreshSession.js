import mongoose from 'mongoose';

const { Schema } = mongoose;

const refreshSessionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      maxlength: 500,
      default: null,
    },
    ipAddress: {
      type: String,
      maxlength: 100,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByJti: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });
refreshSessionSchema.index({ familyId: 1, revokedAt: 1 });

const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
export default RefreshSession;
