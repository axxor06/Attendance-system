import asyncHandler from 'express-async-handler';
import { User, RefreshSession, Department } from '../models/index.js';
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
import { OTP_PURPOSE, NOTIFICATION_TYPE, ACTIVITY_ACTION, canonicalRole, ROLES } from '../config/constants.js';
import {
  getClientIp,
  getRefreshExpiryDate,
  hashRefreshToken,
  isConcurrentRotationGraceEligible,
} from '../utils/refreshSession.js';
import { getLoginFailureReset, getLoginFailureUpdate, isLoginTemporarilyLocked } from '../utils/loginProtection.js';
import { isValidDateOnly } from '../utils/dateOfBirth.js';
import { bindOrVerifyStudentDevice } from '../utils/deviceBinding.js';
import { isAllowedProfileImageUrl } from '../services/imagekitService.js';
import { ACADEMIC_IDENTIFIER_MESSAGE, isValidAcademicIdentifier, normalizeAcademicIdentifier } from '../utils/identifierPolicy.js';

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

async function sendPasswordChangedNotice(req, user) {
  try {
    await sendPasswordChangedEmail({ to: user.email, name: user.name });
  } catch (error) {
    // Credential changes are already committed; SMTP delivery is a non-critical
    // side effect and must not turn a successful security action into a 500.
    console.warn(`[${req.id || 'no-request-id'}] Password-change email delivery failed (${error?.code || 'unknown'}).`);
  }
}

async function loadSafeAuthUser(userId) {
  const user = await User.findById(userId)
    .select('+passwordResetRequired')
    .populate('department', 'name code programLevel semesterCount')
    .populate({ path: 'class', select: 'name code semester', populate: { path: 'semester', select: 'name number' } });
  return user?.toSafeObject();
}

async function canUseConcurrentRefreshGrace(session, tokenHash, familyId, now) {
  if (!isConcurrentRotationGraceEligible(session, tokenHash, now)) return false;
  return Boolean(await RefreshSession.exists({
    familyId,
    revokedAt: null,
    expiresAt: { $gt: now },
  }));
}

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

export function isTemporaryPasswordExpired(user, now = new Date()) {
  if (!user?.passwordResetRequired || !user.passwordResetExpiresAt) return false;
  return new Date(user.passwordResetExpiresAt).getTime() <= new Date(now).getTime();
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
  }).select('+password +failedLoginAttempts +loginFailureWindowStartedAt +loginLockedUntil +passwordResetRequired +passwordResetExpiresAt +deviceBindingHash +roleModelVersion');

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
  if (isTemporaryPasswordExpired(user)) {
    throw ApiError.unauthorized('This temporary password has expired. Ask your HOD to issue a new one.');
  }
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated. Contact your administrator.');
  if (canonicalRole(user.role) === ROLES.ADMIN && user.roleModelVersion !== 2) throw ApiError.forbidden('This account requires the canonical role migration before it can sign in. Contact your HOD.');
  user.role = canonicalRole(user.role);
  if (user.role === ROLES.USER && !user.isEmailVerified) {
    throw ApiError.forbidden('Please verify your email before logging in.');
  }

  await bindOrVerifyStudentDevice(user, req, User);
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

  const safeUser = await loadSafeAuthUser(user._id);
  return sendResponse(res, 200, 'Login successful', {
    accessToken,
    requiresPasswordChange: Boolean(user.passwordResetRequired),
    user: safeUser,
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
  const graceRetry = await canUseConcurrentRefreshGrace(observedSession, tokenHash, familyId, now);
  if ((!graceRetry && observedSession.revokedAt)
    || observedSession.tokenHash !== tokenHash
    || observedSession.expiresAt <= now) {
    await revokeRefreshFamily(familyId);
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh session is no longer valid. Please log in again.');
  }

  const user = await User.findById(decoded.id).select('+passwordResetRequired +deviceBindingHash');
  if (!user || !user.isActive) {
    await revokeAllUserSessions(decoded.id);
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Account no longer available.');
  }

  await bindOrVerifyStudentDevice(user, req, User);

  // A short, same-token grace path lets legitimate multi-tab races rotate again
  // without treating the race as theft. Outside this bounded window, the old
  // token remains a reuse signal and the family is revoked.
  if (graceRetry) {
    const { token: graceToken } = await createRefreshSession(user, req, familyId);
    setRefreshCookie(res, graceToken);
    return sendResponse(res, 200, 'Token refreshed', {
      accessToken: generateAccessToken(user),
      user: await loadSafeAuthUser(user._id),
    });
  }

  // Create the descendant first, then atomically claim the current token. If
  // another request wins the claim, inspect the just-updated session for the
  // bounded concurrent-rotation grace path before treating it as reuse.
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
    await RefreshSession.updateOne(
      { jti: nextDecoded.jti, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    const latestSession = await RefreshSession.findById(observedSession._id).select('+tokenHash');
    if (await canUseConcurrentRefreshGrace(latestSession, tokenHash, familyId, new Date())) {
      const { token: graceToken } = await createRefreshSession(user, req, familyId);
      setRefreshCookie(res, graceToken);
      return sendResponse(res, 200, 'Token refreshed', {
        accessToken: generateAccessToken(user),
        user: await loadSafeAuthUser(user._id),
      });
    }
    await revokeRefreshFamily(familyId);
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh session reuse detected. Please log in again.');
  }

  setRefreshCookie(res, nextToken);
  return sendResponse(res, 200, 'Token refreshed', {
    accessToken: generateAccessToken(user),
    user: await loadSafeAuthUser(user._id),
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

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +passwordResetRequired +passwordResetExpiresAt');
  if (!user) throw ApiError.notFound('No account found with this email.');
  if (await user.comparePassword(newPassword)) throw ApiError.badRequest('Choose a password different from your current password.');

  user.password = newPassword;
  user.passwordResetRequired = false;
  user.passwordResetExpiresAt = null;
  Object.assign(user, getLoginFailureReset());
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeAllUserSessions(user._id);

  await sendPasswordChangedNotice(req, user);
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
  const user = await User.findById(req.user._id).select('+password +passwordResetExpiresAt');
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.badRequest('Current password is incorrect.');
  if (await user.comparePassword(newPassword)) throw ApiError.badRequest('Choose a password different from your current password.');

  user.password = newPassword;
  user.passwordResetRequired = false;
  user.passwordResetExpiresAt = null;
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeAllUserSessions(user._id);
  clearRefreshCookie(res);

  await sendPasswordChangedNotice(req, user);
  await notifyUser({
    userId: user._id,
    type: NOTIFICATION_TYPE.PASSWORD_CHANGED,
    title: 'Password changed',
    message: 'Your password was changed successfully.',
  });

  return sendResponse(res, 200, 'Password changed successfully.');
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, email, phone, dateOfBirth, designation, qualification, admissionYear, avatarUrl, employeeId, department } = req.body;
  if (dateOfBirth !== undefined && dateOfBirth !== null && dateOfBirth !== '' && !isValidDateOnly(dateOfBirth)) throw ApiError.badRequest('Date of birth must be a valid non-future date in YYYY-MM-DD format.');
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('Account not found.');

  const userRole = canonicalRole(user.role);
  const canEditIdentity = userRole === ROLES.SUPER_ADMIN;
  const canEditPhoto = userRole !== ROLES.USER;
  if (dateOfBirth !== undefined && !canEditIdentity) throw ApiError.forbidden('Only authorized academic staff can change date of birth.');
  if (avatarUrl !== undefined && !canEditPhoto) throw ApiError.forbidden('Student profile photos are set during registration and cannot be changed.');
  if (avatarUrl !== undefined && !isAllowedProfileImageUrl(avatarUrl)) throw ApiError.badRequest('Profile photo must be uploaded through configured image storage.');
  if (employeeId !== undefined && !canEditIdentity) throw ApiError.forbidden('Only authorized academic staff can change employee IDs.');
  if ((designation !== undefined || qualification !== undefined || admissionYear !== undefined) && !canEditIdentity) throw ApiError.forbidden('Only authorized academic staff can change academic profile details.');
  if (department !== undefined && !canEditIdentity) throw ApiError.forbidden('Only authorized academic staff can change departments.');

  if (name !== undefined) {
    if (!canEditIdentity) {
      throw ApiError.forbidden('Students and faculty cannot change their name.');
    }
    user.name = name;
  }
  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail !== user.email) {
      const duplicate = await User.exists({ email: normalizedEmail, _id: { $ne: user._id } });
      if (duplicate) throw ApiError.emailAlreadyExists();
      user.email = normalizedEmail;
      user.isEmailVerified = true;
    }
  }
  if (phone !== undefined) user.phone = phone || null;
  if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
  if (designation !== undefined) user.designation = designation || null;
  if (qualification !== undefined) user.qualification = qualification || null;
  if (admissionYear !== undefined) user.admissionYear = admissionYear || null;
  if (employeeId !== undefined) {
    const normalizedEmployeeId = normalizeAcademicIdentifier(employeeId);
    if (normalizedEmployeeId && !isValidAcademicIdentifier(normalizedEmployeeId)) throw ApiError.badRequest(`Employee ID is invalid. ${ACADEMIC_IDENTIFIER_MESSAGE}`);
    if (normalizedEmployeeId) {
      const duplicateEmployeeId = await User.exists({ employeeId: normalizedEmployeeId, _id: { $ne: user._id } });
      if (duplicateEmployeeId) throw ApiError.conflict('This employee ID already exists.');
    }
    user.employeeId = normalizedEmployeeId || null;
  }
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || null;
  if (department !== undefined) {
    const departmentDoc = await Department.findOne({ _id: department, isActive: true }).select('_id');
    if (!departmentDoc) throw ApiError.badRequest('Choose an active department.');
    user.department = departmentDoc._id;
  }
  await user.save();

  await logActivity({
    actorId: user._id,
    action: ACTIVITY_ACTION.UPDATE,
    targetType: 'User',
    targetId: user._id,
    description: department !== undefined ? 'Updated personal contact and department details' : 'Updated personal contact details',
    ipAddress: getClientIp(req),
    requestId: req.id,
  });

  const safeUser = await User.findById(user._id)
    .populate('department', 'name code programLevel semesterCount')
    .populate({ path: 'class', select: 'name code semester', populate: { path: 'semester', select: 'name number' } });
  return sendResponse(res, 200, 'Profile updated successfully.', { user: safeUser.toSafeObject() });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('+passwordResetRequired')
    .populate('department', 'name code programLevel semesterCount')
    .populate({ path: 'class', select: 'name code semester', populate: { path: 'semester', select: 'name number' } });
  return sendResponse(res, 200, 'Current user fetched', { user: user.toSafeObject() });
});
