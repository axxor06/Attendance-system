import mongoose from 'mongoose';
import { OTP_PURPOSE } from '../config/constants.js';

const { Schema } = mongoose;

const otpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    codeHash: {
      // OTP is hashed at rest, same as a password, never stored plaintext
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: Object.values(OTP_PURPOSE),
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
      max: 10,
    },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, purpose: 1 });
// TTL index: MongoDB automatically deletes the document once expiresAt passes,
// so stale/expired OTPs never accumulate.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model('Otp', otpSchema);

export default Otp;
