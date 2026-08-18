import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A student's self-registration request, pending HOD approval.
 * Only a bcrypt password hash is stored; plaintext credentials never reach MongoDB.
 */
const registrationRequestSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    registerNumber: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    passwordHash: { type: String, default: null, select: false },
    statusTokenHash: { type: String, default: null, select: false },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

registrationRequestSchema.index({ email: 1, status: 1 });
registrationRequestSchema.index({ status: 1, createdAt: -1 });
registrationRequestSchema.index({ statusTokenHash: 1 }, { sparse: true });

const RegistrationRequest = mongoose.model('RegistrationRequest', registrationRequestSchema);
export default RegistrationRequest;
