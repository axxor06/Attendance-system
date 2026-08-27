import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ALL_ACCEPTED_ROLE_LIST, canonicalRole, ROLES } from '../config/constants.js';
import { calculateAge, isValidDateOnly } from '../utils/dateOfBirth.js';

const { Schema } = mongoose;

/**
 * Single "users" collection for all three roles (HOD, Faculty, Student).
 * Role-specific relational fields (department, class, employeeId, etc.)
 * live here directly rather than in separate collections, because in this
 * domain a user IS exactly one role for their account's lifetime, and
 * keeping everything in one collection avoids a join on every login/auth
 * check. Role-specific business data that has its own lifecycle (subjects
 * taught, attendance records) lives in its own collection instead.
 */
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [function passwordRequired() { return !this.passwordResetRequired; }, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ALL_ACCEPTED_ROLE_LIST,
      required: true,
    },
    // Null means a legacy record has not completed the explicit p27 role migration.
    roleModelVersion: {
      type: Number,
      default: null,
      min: 2,
      select: false,
    },

    // ---- Identity / role-specific fields ----
    registerNumber: {
      // students only - unique roll/register number
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    employeeId: {
      // faculty + hod
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: String,
      default: null,
      validate: {
        validator: (value) => value == null || isValidDateOnly(value),
        message: 'Date of birth must be a valid non-future date in YYYY-MM-DD format.',
      },
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    qualification: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    admissionYear: {
      type: Number,
      min: 2000,
      max: 2200,
      default: null,
    },

    // ---- Relations ----
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    class: {
      // students belong to exactly one class (dept+semester)
      type: Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },

    // ---- Account status ----
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 20,
      select: false,
    },
    loginFailureWindowStartedAt: {
      type: Date,
      default: null,
      select: false,
    },
    loginLockedUntil: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetRequired: {
      type: Boolean,
      default: false,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    deviceBindingHash: {
      type: String,
      default: null,
      select: false,
    },
    deviceBoundAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ role: 1, name: 1, createdAt: -1 });
userSchema.index({ role: 1, email: 1 });
userSchema.index({ role: 1, registerNumber: 1 });
userSchema.index({ role: 1, employeeId: 1 });
userSchema.index({ department: 1 });
userSchema.index({ class: 1 });
userSchema.index({ deviceBindingHash: 1 }, { sparse: true });

userSchema.pre('validate', function normalizeLegacyRole(next) {
  const normalizedRole = canonicalRole(this.role);
  if (['super_admin', 'admin', 'user'].includes(normalizedRole)) this.role = normalizedRole;
  next();
});

userSchema.pre('save', function markCanonicalRole(next) {
  if (this.roleModelVersion == null && ['super_admin', 'admin', 'user'].includes(canonicalRole(this.role))) this.roleModelVersion = 2;
  next();
});

// Hash password before save, only if it was modified.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || this.$locals.passwordAlreadyHashed) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password || !candidate) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isHod = function isHod() {
  return canonicalRole(this.role) === ROLES.SUPER_ADMIN;
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  obj.role = canonicalRole(obj.role);
  delete obj.password;
  delete obj.tokenVersion;
  delete obj.failedLoginAttempts;
  delete obj.loginFailureWindowStartedAt;
  delete obj.loginLockedUntil;
  delete obj.deviceBindingHash;
  obj.requiresPasswordChange = Boolean(this.passwordResetRequired);
  obj.age = this.dateOfBirth ? calculateAge(this.dateOfBirth) : null;
  delete obj.passwordResetRequired;
  delete obj.passwordResetExpiresAt;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
