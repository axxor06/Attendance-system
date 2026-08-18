import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import { User, RefreshSession, Department, Class } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { sendAccountCreatedEmail, sendOtpEmail } from '../utils/email.js';
import { notifyUser } from '../services/notificationService.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, NOTIFICATION_TYPE, OTP_PURPOSE, ROLES } from '../config/constants.js';
import { createOtp } from '../utils/otp.js';
import { getLoginFailureReset } from '../utils/loginProtection.js';
import {
  allowedUserCreationRoles,
  applyUserScope,
  assertManageableUser,
  getDepartmentScope,
  isGlobalAdministrator,
  isHod,
  isSameId,
} from '../utils/authorization.js';

function generateBootstrapPassword() {
  return `Aa9!${crypto.randomBytes(10).toString('base64url')}`;
}

function privilegedRole(role) {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HOD].includes(role);
}

async function revokeUserSessions(userId) {
  await RefreshSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function resolveDepartmentAndClass({ actor, role, departmentId, classId }) {
  let resolvedDepartment = departmentId || null;
  let classDoc = null;

  if (classId) {
    classDoc = await Class.findOne({ _id: classId, isActive: true }).select('_id department');
    if (!classDoc) throw ApiError.badRequest('Invalid or inactive class.');
    if (resolvedDepartment && !isSameId(resolvedDepartment, classDoc.department)) {
      throw ApiError.badRequest('The selected class does not belong to the selected department.');
    }
    resolvedDepartment = classDoc.department;
  }

  if ([ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT].includes(role) && !resolvedDepartment) {
    throw ApiError.badRequest('A department is required for this account role.');
  }
  if (isHod(actor) && !isSameId(actor.department, resolvedDepartment)) {
    throw ApiError.forbidden('You can only assign accounts within your department.');
  }
  if (resolvedDepartment) {
    const departmentDoc = await Department.findOne({ _id: resolvedDepartment, isActive: true }).select('_id');
    if (!departmentDoc) throw ApiError.badRequest('Invalid or inactive department.');
  }
  if (role === ROLES.STUDENT && !classDoc) {
    throw ApiError.badRequest('A class must be assigned when creating or moving a student.');
  }
  return { department: resolvedDepartment, classDoc };
}

export const createUser = asyncHandler(async (req, res) => {
  const {
    name, email, role, registerNumber, employeeId, department, classId, phone, password,
  } = req.body;
  const allowedRoles = allowedUserCreationRoles(req.user);
  if (!allowedRoles.includes(role)) throw ApiError.forbidden('This role cannot be created by your account.');
  if (role === ROLES.SUPER_ADMIN) throw ApiError.forbidden('SUPER_ADMIN accounts cannot be created through this endpoint.');

  const { department: resolvedDepartment, classDoc } = await resolveDepartmentAndClass({
    actor: req.user, role, departmentId: department, classId,
  });
  const normalizedEmail = String(email).toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw ApiError.conflict('An account with this email already exists.');

  if (role === ROLES.STUDENT && registerNumber && await User.exists({ registerNumber })) {
    throw ApiError.conflict('A student with this register number already exists.');
  }
  if ([ROLES.ADMIN, ROLES.HOD, ROLES.FACULTY].includes(role) && employeeId && await User.exists({ employeeId })) {
    throw ApiError.conflict('A staff member with this employee ID already exists.');
  }

  const providedPassword = Boolean(password);
  const user = await User.create({
    name,
    email: normalizedEmail,
    password: password || generateBootstrapPassword(),
    passwordResetRequired: !providedPassword,
    role,
    registerNumber: role === ROLES.STUDENT ? registerNumber || undefined : undefined,
    employeeId: role !== ROLES.STUDENT ? employeeId || undefined : undefined,
    department: resolvedDepartment,
    class: role === ROLES.STUDENT ? classDoc._id : null,
    phone: phone || undefined,
    isEmailVerified: true,
    createdBy: req.user._id,
  });

  if (providedPassword) {
    await sendAccountCreatedEmail({
      to: user.email,
      name: user.name,
      role: user.role,
      credentialsMessage: 'Please use the credentials provided to you by your administrator.',
    });
  } else {
    const code = await createOtp(user.email, OTP_PURPOSE.PASSWORD_RESET, {
      expiresMinutes: privilegedRole(user.role) ? 5 : undefined,
      maxAttempts: privilegedRole(user.role) ? 3 : undefined,
    });
    await sendOtpEmail({ to: user.email, name: user.name, otp: code, purpose: OTP_PURPOSE.PASSWORD_RESET });
  }

  await notifyUser({ userId: user._id, type: NOTIFICATION_TYPE.ACCOUNT_CREATED, title: 'Welcome', message: `Your ${role} account has been created.` });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.CREATE, targetType: 'User', targetId: user._id, description: `Created ${role} account for ${user.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 201, `${role} account created successfully`, { user: user.toSafeObject() });
});

export const getUsers = asyncHandler(async (req, res) => {
  const { role, department, classId, search, page = 1, limit = 25 } = req.query;
  const manageableRoles = allowedUserCreationRoles(req.user);
  if (role && !manageableRoles.includes(role)) throw ApiError.forbidden('This role is not available in your view.');
  if (isHod(req.user) && department && !isSameId(req.user.department, department)) {
    throw ApiError.forbidden('You are not authorized to view another department.');
  }
  const filter = await applyUserScope(req, {
    role: role ? role : { $in: manageableRoles },
    ...(department ? { department } : {}),
    ...(classId ? { class: classId } : {}),
  });
  if (search) {
    const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
    filter.$and = [
      ...(filter.$and || []),
      { $or: [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { registerNumber: { $regex: escapedSearch, $options: 'i' } },
        { employeeId: { $regex: escapedSearch, $options: 'i' } },
      ] },
    ];
  }
  const pageNum = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const limitNum = Math.min(100, Math.max(1, Number.isInteger(Number(limit)) ? Number(limit) : 25));
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password -tokenVersion -failedLoginAttempts -loginFailureWindowStartedAt -loginLockedUntil -passwordResetRequired')
      .populate('department', 'name code')
      .populate('class', 'name code department')
      .sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    User.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Users fetched', { users, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
});

export const getUserById = asyncHandler(async (req, res) => {
  const filter = await applyUserScope(req, { _id: req.params.id });
  const user = await User.findOne(filter).select('-password').populate('department', 'name code').populate('class', 'name code');
  await assertManageableUser(req.user, user);
  return sendResponse(res, 200, 'User fetched', { user: user.toSafeObject() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { name, email, phone, registerNumber, employeeId, department, classId, isActive, avatarUrl } = req.body;
  const filter = await applyUserScope(req, { _id: req.params.id });
  const user = await User.findOne(filter);
  await assertManageableUser(req.user, user);

  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const duplicate = await User.exists({ email: normalizedEmail, _id: { $ne: user._id } });
    if (duplicate) throw ApiError.conflict('An account with this email already exists.');
    user.email = normalizedEmail;
    user.isEmailVerified = true;
  }
  if ((registerNumber !== undefined || employeeId !== undefined) && !isGlobalAdministrator(req.user)) {
    throw ApiError.forbidden('Only administrators can change register or employee IDs.');
  }
  if (registerNumber !== undefined && user.role === ROLES.STUDENT) user.registerNumber = registerNumber || null;
  if (employeeId !== undefined && user.role !== ROLES.STUDENT) user.employeeId = employeeId || null;

  let resolvedDepartment = user.department;
  let resolvedClass = user.class;
  if (department !== undefined || classId !== undefined) {
    const relationship = await resolveDepartmentAndClass({
      actor: req.user,
      role: user.role,
      departmentId: department === undefined ? user.department : department,
      classId: classId === undefined ? user.class : classId,
    });
    resolvedDepartment = relationship.department;
    resolvedClass = relationship.classDoc?._id || null;
  }
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone || null;

  if (department !== undefined || classId !== undefined) {
    user.department = resolvedDepartment;
    if (user.role === ROLES.STUDENT) user.class = resolvedClass;
  }
  if (isActive !== undefined) {
    const nextActiveState = Boolean(isActive);
    if (user.isActive && !nextActiveState) user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    user.isActive = nextActiveState;
  }
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  await user.save();
  if (isActive === false) await revokeUserSessions(user._id);
  await logActivity({ actorId: req.user._id, action: isActive === false ? ACTIVITY_ACTION.DEACTIVATE : ACTIVITY_ACTION.UPDATE, targetType: 'User', targetId: user._id, description: isActive === false ? `Deactivated user ${user.name}` : `Updated user ${user.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'User updated successfully', { user: user.toSafeObject() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findOne(await applyUserScope(req, { _id: req.params.id }));
  await assertManageableUser(req.user, user);
  user.isActive = false;
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeUserSessions(user._id);
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.DEACTIVATE, targetType: 'User', targetId: user._id, description: `Deactivated user ${user.name}; academic records retained`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'User deactivated successfully');
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  if (req.body.newPassword) throw ApiError.badRequest('Administrator resets use a secure email reset code. Omit newPassword and ask the user to check their email.');
  const user = await User.findOne(await applyUserScope(req, { _id: req.params.id })).select('+passwordResetRequired');
  await assertManageableUser(req.user, user);
  const code = privilegedRole(user.role)
    ? await createOtp(user.email, OTP_PURPOSE.PASSWORD_RESET, { expiresMinutes: 5, maxAttempts: 3 })
    : await createOtp(user.email, OTP_PURPOSE.PASSWORD_RESET);
  user.passwordResetRequired = true;
  Object.assign(user, getLoginFailureReset());
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  await revokeUserSessions(user._id);
  await sendOtpEmail({ to: user.email, name: user.name, otp: code, purpose: OTP_PURPOSE.PASSWORD_RESET });
  await notifyUser({ userId: user._id, type: NOTIFICATION_TYPE.PASSWORD_CHANGED, title: 'Password reset by administrator', message: 'A secure password reset code was sent to your email by an administrator.' });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.PASSWORD_RESET, targetType: 'User', targetId: user._id, description: `Reset password for ${user.name}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'A secure password reset code was emailed to the user.');
});
