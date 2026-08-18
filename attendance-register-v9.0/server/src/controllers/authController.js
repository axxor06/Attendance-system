import asyncHandler from 'express-async-handler';
import { User, RefreshSession } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  parseDurationToMs,
} from '../utils/jwt.js';
import { createOtp, verifyOtp } from '../utils/otp.js';
import { sendOtpEmail, sendPasswordChangedEmail } from '../utils/email.js';
import { notifyUser } from '../services/notificationService.js';
import { logActivity } from '../services/activityLogService.js';
import { OTP_PURPOSE, NOTIFICATION_TYPE, ACTIVITY_ACTION, ROLES } from '../config/constants.js';
import { getClientIp, getRefreshExpiryDate, hashRefreshToken } from '../utils/refreshSession.js';
import { getLoginFailureReset, getLoginFailureUpdate, isLoginTemporarilyLocked } from '../utils/loginProtection.js';

const COOKIE_NAME = 'refreshToken';
const COOKIE_PATH = '/';

function refreshCookieOptions() {
  const secure = process.env.NODE_ENV === 'production' || process.env.REFRESH_COOKIE_SECURE === 'true';
  const requestedSameSite = (process.env.REFRESH_COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSiteValue = ['strict', 'lax', 'none'].includes(requestedSameSite) ? requestedSameSite : 'lax';
  const sameSite = sameSiteValue === 'none' && !secure ? 'lax' : sameSiteValue;
  return {
    httpOnly: true,
    secure,
    sameSite,
    ...(process.env.REFRESH_COOKIE_DOMAIN ? { domain: process.env.REFRESH_COOKIE_DOMAIN } : {}),
    maxAge: parseDurationToMs(process.env.JWT_REFRESH_EXPIRES),
    path: COOKIE_PATH,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const options = refreshCookieOptions();
  delete options.maxAge;
  res.clearCookie(COOKIE_NAME, options);
}

async function createRefreshSession(user, req, familyId = null) {
  const token = generateRefreshToken(user);
  const decoded = verifyRefreshToken(token);
  await RefreshSession.create({
    user: user._id,
    jti: decoded.jti,
    familyId: familyId || decoded.jti,
    tokenHash: hashRefreshToken(token),
    expiresAt: getRefreshExpiryDate(decoded),
    userAgent: req.get('user-agent')?.slice(0, 500) || null,
    ipAddress: getClientIp(req),
  });
  return { token, decoded };
}

async function revokeAllUserSessions(userId) {
  await RefreshSession.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

async function revokeRefreshFamily(familyId) {
  if (!familyId) return;
  await RefreshSession.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export const registerStudent = asyncHandler(async (req, res) => {
  const { name, email, password, registerNumber, classId, phone } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists.');

  if (registerNumber) {
    const existingReg = await User.findOne({ registerNumber });
    if (existingReg) throw ApiError.conflict('A student with this register number already exists.');
  }

  const user = await User.create({
    name, email, password,
    role: ROLES.STUDENT,
    registerNumber: registerNumber || undefined,
    class: classId || null,
    phone: phone || undefined,
    isEmailVerified: false,
  });

  const code = await createOtp(user.email, OTP_PURPOSE.EMAIL_VERIFICATION);
  await sendOtpEmail({ to: user.email, name: user.name, otp: code, purpose: OTP_PURPOSE.EMAIL_VERIFICATION });

  return sendResponse(res, 201, 'Account created. Please check your email for a verification code.', {
    email: user.email,
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const result = await verifyOtp(email, OTP_PURPOSE.EMAIL_VERIFICATION, otp);
  if (!result.valid) throw ApiError.badRequest(result.reason);

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { isEmailVerified: true },
    { new: true }
  );
  if (!user) throw ApiError.notFound('No account found with this email.');

  await notifyUser({
    userId: user._id,
    type: NOTIFICATION_TYPE.ACCOUNT_CREATED,
    title: 'Email verified',
    message: 'Your email has been verified. You can now log in.',
  });

  return sendResponse(res, 200, 'Email verified successfully. You can now log in.');
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { email, purpose } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return sendResponse(res, 200, 'If an account exists, a code has been sent.');

  const otpPurpose = purpose === OTP_PURPOSE.PASSWORD_RESET
    ? OTP_PURPOSE.PASSWORD_RESET
    : OTP_PURPOSE.EMAIL_VERIFICATION;

  const code = await createOtp(user.email, otpPurpose);
  await sendOtpEmail({ to: user.email, name: user.name, otp: code, purpose: otpPurpose });

  return sendResponse(res, 200, 'If an account exists, a code has been sent.');
});

async function logFailedLogin(req, user, description = 'Failed login attempt') {
  let loginFailureUpdate = null;
  if (user) {
    loginFailureUpdate = getLoginFailureUpdate(user);
    await User.updateOne({ _id: user._id }, { $set: loginFailureUpdate });
  }
  await logActivity({
    ...(user ? { actorId: user._id, targetType: 'User', targetId: user._id } : { targetType: 'Auth' }),
    action: ACTIVITY_ACTION.FAILED_LOGIN,
    description,
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent')?.slice(0, 500),
    requestId: req.id,
  });
  return loginFailureUpdate;
}

function setRetryAfter(res, lockedUntil) {
  const retryAfterSeconds = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
  res.set('Retry-After', String(Math.min(retryAfterSeconds, 24 * 60 * 60)));
}

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    throw ApiError.badRequest('Email/Register number and password are required.');
  }

  const normalized = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: normalized }, { registerNumber: identifier.trim() }],
  }).select('+password +failedLoginAttempts +loginFailureWindowStartedAt +loginLockedUntil +passwordResetRequired');

  if (!user) {
    await logFailedLogin(req, null);
    throw ApiError.unauthorized('Invalid credentials.');
  }
  if (isLoginTemporarilyLocked(user)) {
    await logFailedLogin(req, user, 'Temporarily locked login attempt');
    setRetryAfter(res, user.loginLockedUntil);
    throw ApiError.tooManyRequests('Too many unsuccessful login attempts. Try again later.');
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const failureState = await logFailedLogin(req, user);
    if (failureState?.loginLockedUntil) {
      setRetryAfter(res, failureState.loginLockedUntil);
      throw ApiError.tooManyRequests('Too many unsuccessful login attempts. Try again later.');
    }
    throw ApiError.unauthorized('Invalid credentials.');
  }
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact your administrator.');
  if (user.passwordResetRequired) {
    throw ApiError.forbidden('A password reset is required. Use the reset code sent to your email.');
  }
  if (user.role === ROLES.STUDENT && !user.isEmailVerified) {
    throw ApiError.forbidden('Please verify your email before logging in.');
  }

  user.lastLoginAt = new Date();
  Object.assign(user, getLoginFailureReset());
  await user.save();

  const accessToken = generateAccessToken(user);
  const { token: refreshToken } = await createRefreshSession(user, req);
  setRefreshCookie(res, refreshToken);

  await logActivity({
    actorId: user._id,
    action: ACTIVITY_ACTION.LOGIN,
    targetType: 'User',
    targetId: user._id,
    description: `${user.name} logged in`,
    ipAddress: getClientIp(req),
    userAgent: req.get('user-agent')?.slice(0, 500),
    requestId: req.id,
  });

  return sendResponse(res, 200, 'Login successful', {
    accessToken,
    user: user.toSafeObject(),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw ApiError.unauthorized('No refresh token provided.');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Invalid or expired refresh token. Please log in again.');
  }

  const tokenHash = hashRefreshToken(token);
  const observedSession = await RefreshSession.findOne({ jti: decoded.jti, user: decoded.id }).select('+tokenHash');
  if (!observedSession) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh session is no longer valid. Please log in again.');
  }

  const familyId = observedSession.familyId || observedSession.jti;
  const now = new Date();
  if (observedSession.revokedAt || observedSession.tokenHash !== tokenHash || observedSession.expiresAt <= now) {
    await revokeRefreshFamily(familyId);
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh session is no longer valid. Please log in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    await revokeAllUserSessions(decoded.id);
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Account no longer available.');
  }

  // Create the descendant first, then atomically claim the current token. If
  // another request wins the claim, the family is revoked, including the
  // descendant that this losing request just created.
  const { token: nextToken, decoded: nextDecoded } = await createRefreshSession(user, req, familyId);
  const claimedSession = await RefreshSession.findOneAndUpdate(
    {
      _id: observedSession._id,
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { revokedAt: now, lastUsedAt: now, replacedByJti: nextDecoded.jti } },
    { new: true }
  );

  if (!claimedSession) {
    await revokeRefreshFamily(familyId);
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh session reuse detected. Please log in again.');
  }

  setRefreshCookie(res, nextToken);
  return sendResponse(res, 200, 'Token refreshed', {
    accessToken: generateAccessToken(user),
    user: user.toSafeObject(),
  });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      await RefreshSession.updateOne(
        { jti: decoded.jti, tokenHash: hashRefreshToken(token), revokedAt: null },
        { $set: { revokedAt: new Date(), lastUsedAt: new Date() } }
      );
    } catch {
      // Logout remains idempotent even when the cookie is expired or malformed.
    }
  }
  clearRefreshCookie(res);
  return sendResponse(res, 200, 'Logged out successfully.');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return sendResponse(res, 200, 'If an account exists, a reset code has been sent.');

  const code = await createOtp(user.email, OTP_PURPOSE.PASSWORD_RESET);
  await sendOtpEmail({ to: user.email, name: user.name, otp: code, purpose: OTP_PURPOSE.PASSWORD_RESET });

  return sendResponse(res, 200, 'If an account exists, a reset code has been sent.');
});

export const verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const result = await verifyOtp(email, OTP_PURPOSE.PASSWORD_RESET, otp, { consume: false });
  if (!result.valid) throw ApiError.badRequest(result.reason);
  return sendResponse(res, 200, 'Reset code verified. Choose a new password.');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const result = await verifyOtp(email, OTP_PURPOSE.PASSWORD_RESET, otp);
  if (!result.valid) throw ApiError.badRequest(result.reason);

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +passwordResetRequired');
  if (!user) throw ApiError.notFound('No account found with this email.');
  if (await user.comparePassword(newPassword)) throw ApiError.badRequest('Choose a password different from your current password.');

  user.password = newPassword;
  user.passwordResetRequired = false;
  Object.assign(user, getLoginFailureReset());
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeAllUserSessions(user._id);

  await sendPasswordChangedEmail({ to: user.email, name: user.name });
  await notifyUser({
    userId: user._id,
    type: NOTIFICATION_TYPE.PASSWORD_CHANGED,
    title: 'Password changed',
    message: 'Your password was reset successfully.',
  });

  return sendResponse(res, 200, 'Password reset successfully. You can now log in.');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.badRequest('Current password is incorrect.');
  if (await user.comparePassword(newPassword)) throw ApiError.badRequest('Choose a password different from your current password.');

  user.password = newPassword;
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeAllUserSessions(user._id);
  clearRefreshCookie(res);

  await sendPasswordChangedEmail({ to: user.email, name: user.name });
  await notifyUser({
    userId: user._id,
    type: NOTIFICATION_TYPE.PASSWORD_CHANGED,
    title: 'Password changed',
    message: 'Your password was changed successfully.',
  });

  return sendResponse(res, 200, 'Password changed successfully.');
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, email, phone, avatarUrl } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('Account not found.');

  if (name !== undefined) {
    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HOD].includes(user.role)) {
      throw ApiError.forbidden('Students and faculty cannot change their name.');
    }
    user.name = name;
  }
  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail !== user.email) {
      const duplicate = await User.exists({ email: normalizedEmail, _id: { $ne: user._id } });
      if (duplicate) throw ApiError.conflict('An account with this email already exists.');
      user.email = normalizedEmail;
      user.isEmailVerified = true;
    }
  }
  if (phone !== undefined) user.phone = phone || null;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || null;
  await user.save();

  await logActivity({
    actorId: user._id,
    action: ACTIVITY_ACTION.UPDATE,
    targetType: 'User',
    targetId: user._id,
    description: 'Updated personal contact details',
    ipAddress: getClientIp(req),
    requestId: req.id,
  });

  const safeUser = await User.findById(user._id)
    .populate('department', 'name code')
    .populate('class', 'name code');
  return sendResponse(res, 200, 'Profile updated successfully.', { user: safeUser.toSafeObject() });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('department', 'name code')
    .populate('class', 'name code');
  return sendResponse(res, 200, 'Current user fetched', { user: user.toSafeObject() });
});
