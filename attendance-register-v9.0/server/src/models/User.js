import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_LIST, ROLES } from '../config/constants.js';

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
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ROLE_LIST,
      required: true,
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ class: 1 });

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
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isHod = function isHod() {
  return this.role === ROLES.HOD;
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.tokenVersion;
  delete obj.failedLoginAttempts;
  delete obj.loginFailureWindowStartedAt;
  delete obj.loginLockedUntil;
  delete obj.passwordResetRequired;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
