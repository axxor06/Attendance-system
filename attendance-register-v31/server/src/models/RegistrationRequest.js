import mongoose from 'mongoose';

const { Schema } = mongoose;

import { REGISTRATION_REQUEST_ROLE_LIST, ROLES } from '../config/constants.js';

/**
 * A student's self-registration request, pending HOD approval.
 * Only a bcrypt password hash is stored; plaintext credentials never reach MongoDB.
 */
const registrationRequestSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    requestedRole: { type: String, enum: REGISTRATION_REQUEST_ROLE_LIST, default: ROLES.USER },
    registerNumber: { type: String, trim: true, default: '' },
    employeeId: { type: String, trim: true, default: '' },
    // Assigned only by an authorized HOD during approval; public applicants never set this.
    assignedIdentifier: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    dateOfBirth: { type: String, trim: true, default: null },
    avatarUrl: { type: String, trim: true, default: null },
    department: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    class: { type: Schema.Types.ObjectId, ref: 'Class', default: null },
    passwordHash: { type: String, default: null, select: false },
    // Legacy private-link capability retained for existing requests during migration.
    statusTokenHash: { type: String, default: null, select: false },
    // New short, user-facing capability; only its SHA-256 digest is persisted.
    statusCodeHash: { type: String, default: undefined, select: false },
    statusTokenExpiresAt: { type: Date, default: null },
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
registrationRequestSchema.index({ requestedRole: 1, status: 1 });
registrationRequestSchema.index({ department: 1, status: 1 });
registrationRequestSchema.index({ status: 1, createdAt: -1 });
registrationRequestSchema.index({ statusTokenHash: 1 }, { sparse: true });
registrationRequestSchema.index({ statusCodeHash: 1 }, { sparse: true, unique: true });
registrationRequestSchema.index({ statusTokenExpiresAt: 1 });

const RegistrationRequest = mongoose.model('RegistrationRequest', registrationRequestSchema);
export default RegistrationRequest;
