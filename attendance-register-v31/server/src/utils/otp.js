import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { Otp } from '../models/index.js';

export function generateOtpCode() {
  const length = Number(process.env.OTP_LENGTH) || 6;
  if (!Number.isInteger(length) || length < 4 || length > 8) throw new Error('OTP_LENGTH must be between 4 and 8.');
  const max = 10 ** length;
  const min = 10 ** (length - 1);
  return String(randomInt(min, max));
}

export async function createOtp(email, purpose, options = {}) {
  const normalizedEmail = email.toLowerCase().trim();
  await Otp.deleteMany({ email: normalizedEmail, purpose, consumedAt: null });
  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const defaultMinutes = Number(process.env.OTP_EXPIRES_MINUTES) || 10;
  const defaultAttempts = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
  const expiresMinutes = Number.isFinite(options.expiresMinutes) && options.expiresMinutes > 0
    ? options.expiresMinutes
    : defaultMinutes;
  const maxAttempts = Number.isInteger(options.maxAttempts) && options.maxAttempts > 0
    ? options.maxAttempts
    : defaultAttempts;
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
  await Otp.create({ email: normalizedEmail, codeHash, purpose, expiresAt, maxAttempts });
  return code;
}

export async function verifyOtp(email, purpose, submittedCode, { consume = true } = {}) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const otpDoc = await Otp.findOne({
    email: normalizedEmail,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: now },
    $expr: { $lt: ['$attempts', '$maxAttempts'] },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    const expiredOrConsumed = await Otp.exists({ email: normalizedEmail, purpose });
    return { valid: false, reason: expiredOrConsumed ? 'The code is expired, consumed, or locked. Please request a new one.' : 'No active code found. Please request a new one.' };
  }

  const isMatch = await bcrypt.compare(String(submittedCode), otpDoc.codeHash);
  if (!isMatch) {
    await Otp.findOneAndUpdate(
      { _id: otpDoc._id, consumedAt: null, expiresAt: { $gt: new Date() }, $expr: { $lt: ['$attempts', '$maxAttempts'] } },
      { $inc: { attempts: 1 } },
    );
    return { valid: false, reason: 'Incorrect code. Please try again.' };
  }

  if (!consume) return { valid: true };

  const consumed = await Otp.findOneAndUpdate(
    { _id: otpDoc._id, consumedAt: null, expiresAt: { $gt: new Date() }, $expr: { $lt: ['$attempts', '$maxAttempts'] } },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );
  if (!consumed) return { valid: false, reason: 'This code was already used. Please request a new one.' };
  return { valid: true };
}
