import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { RegistrationRequest, User, Class, Department } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { sendAccountCreatedEmail } from '../utils/email.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, canonicalRole, ROLES } from '../config/constants.js';
import { paginationMeta, parsePagination } from '../utils/pagination.js';
import { isValidDateOnly } from '../utils/dateOfBirth.js';
import { isAllowedProfileImageUrl } from '../services/imagekitService.js';
import { ACADEMIC_IDENTIFIER_MESSAGE, isValidAcademicIdentifier, normalizeAcademicIdentifier } from '../utils/identifierPolicy.js';

const PASSWORD_HASH_ROUNDS = 12;
const STATUS_TOKEN_TTL_DAYS = 30;
const STATUS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STATUS_CODE_PATTERN = /^AR-[A-Z0-9]{4}-[A-Z0-9]{6}$/;

function hashStatusToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function normalizeId(value) {
  return String(value?._id || value || '');
}

function normalizeStatusCode(value) {
  return String(value || '').trim().toUpperCase();
}

function generateStatusCode() {
  let raw = '';
  for (let index = 0; index < 10; index += 1) raw += STATUS_CODE_ALPHABET[crypto.randomInt(0, STATUS_CODE_ALPHABET.length)];
  return `AR-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

async function assertRequestScope(req, request) {
  if (canonicalRole(req.user.role) === ROLES.SUPER_ADMIN) return request;
  throw ApiError.notFound('Request not found.');
}

function canonicalRequestedRole(value) {
  const normalized = String(value || 'student').trim().toLowerCase();
  return normalized === 'faculty' || normalized === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER;
}

function identifierFieldFor(role) {
  return canonicalRole(role) === ROLES.ADMIN ? 'employeeId' : 'registerNumber';
}

function identifierLabelFor(role) {
  return identifierFieldFor(role) === 'employeeId' ? 'employee ID' : 'register number';
}

export const submitRequest = asyncHandler(async (req, res) => {
  const { requestedRole = ROLES.STUDENT, name, email, phone, dateOfBirth, avatarUrl, classId, departmentId, password } = req.body;
  const role = canonicalRequestedRole(requestedRole);
  if (dateOfBirth && !isValidDateOnly(dateOfBirth)) throw ApiError.badRequest('Date of birth must be a valid non-future date in YYYY-MM-DD format.');
  if (!isAllowedProfileImageUrl(avatarUrl)) throw ApiError.badRequest('Profile photo must be uploaded through configured image storage.');
  const normalizedEmail = email.toLowerCase();
  if (await User.findOne({ email: normalizedEmail })) throw ApiError.emailAlreadyExists();
  const existingRequest = await RegistrationRequest.findOne({ email: normalizedEmail });
  if (existingRequest) throw ApiError.conflict(existingRequest.status === 'pending' ? 'A registration request from this email is already pending review.' : 'A registration request from this email was already processed.');

  let classDoc = null;
  let departmentDoc = null;
  if (role === ROLES.STUDENT) {
    classDoc = await Class.findOne({ _id: classId, isActive: true }).select('_id department');
    if (!classDoc) throw ApiError.badRequest('Invalid class selected.');
  } else {
    departmentDoc = await Department.findOne({ _id: departmentId, isActive: true }).select('_id');
    if (!departmentDoc) throw ApiError.badRequest('Select a valid department for the faculty request.');
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  const statusCode = generateStatusCode();
  const request = await RegistrationRequest.create({
    name,
    email: normalizedEmail,
    requestedRole: role,
    registerNumber: '',
    employeeId: '',
    assignedIdentifier: '',
    phone,
    dateOfBirth: dateOfBirth || null,
    avatarUrl: avatarUrl || null,
    department: role === ROLES.FACULTY ? departmentDoc._id : classDoc.department,
    class: classDoc?._id || null,
    passwordHash,
    statusCodeHash: hashStatusToken(statusCode),
    statusTokenExpiresAt: new Date(Date.now() + STATUS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return sendResponse(res, 201, 'Registration request submitted. Save the private status reference below.', { status: 'pending', statusCode });
});

export const listRequests = asyncHandler(async (req, res) => {
  const { status = 'pending' } = req.query;
  let filter = status === 'all' ? {} : { status };
  const pagination = parsePagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const [requests, total] = await Promise.all([
    RegistrationRequest.find(filter).select('_id name email requestedRole phone dateOfBirth avatarUrl department class status rejectionReason assignedIdentifier reviewedBy reviewedAt createdAt updatedAt').populate('class', 'name code department').populate('department', 'name code').populate('reviewedBy', 'name').sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    RegistrationRequest.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Requests fetched', { requests, pagination: paginationMeta({ total, page: pagination.page, limit: pagination.limit }) });
});

export const approveRequest = asyncHandler(async (req, res) => {
  const request = await RegistrationRequest.findById(req.params.id).select('+passwordHash +statusTokenHash');
  if (!request) throw ApiError.notFound('Request not found.');
  await assertRequestScope(req, request);
  if (request.status !== 'pending') throw ApiError.conflict(`Request is already ${request.status}.`);
  if (!request.passwordHash) throw ApiError.conflict('Registration credentials are no longer available. Ask the applicant to submit a new request.');

  const isFacultyRequest = canonicalRole(request.requestedRole) === ROLES.ADMIN;
  const identifier = normalizeAcademicIdentifier(req.body.identifier);
  const identifierField = identifierFieldFor(request.requestedRole);
  const identifierLabel = identifierLabelFor(request.requestedRole);
  if (!isValidAcademicIdentifier(identifier)) {
    throw ApiError.badRequest(`Enter a valid ${identifierLabel}. ${ACADEMIC_IDENTIFIER_MESSAGE}`);
  }
  if (await User.findOne({ email: request.email })) throw ApiError.emailAlreadyExists();
  if (await User.exists({ [identifierField]: identifier })) {
    throw ApiError.conflict(`This ${identifierLabel} already exists. Choose a different one.`);
  }

  const classDoc = !isFacultyRequest ? await Class.findById(request.class).select('department') : null;
  const departmentId = isFacultyRequest ? request.department : classDoc?.department;
  if (!departmentId) throw ApiError.conflict(isFacultyRequest ? 'The requested department is no longer available.' : 'The selected class is no longer available.');

  const claimedRequest = await RegistrationRequest.findOneAndUpdate(
    { _id: request._id, status: 'pending' },
    { $set: { status: 'approved', assignedIdentifier: identifier, reviewedBy: req.user._id, reviewedAt: new Date() } },
    { new: true },
  ).select('+passwordHash');
  if (!claimedRequest) throw ApiError.conflict('This request was already processed. Refresh the review list.');

  const releaseClaim = async () => {
    await RegistrationRequest.updateOne(
      { _id: claimedRequest._id, status: 'approved', assignedIdentifier: identifier },
      { $set: { status: 'pending' }, $unset: { assignedIdentifier: '', reviewedBy: '', reviewedAt: '' } },
    );
  };

  const user = new User({
    name: claimedRequest.name,
    email: claimedRequest.email,
    password: claimedRequest.passwordHash,
    role: isFacultyRequest ? ROLES.FACULTY : ROLES.STUDENT,
    [identifierField]: identifier,
    phone: claimedRequest.phone || undefined,
    dateOfBirth: claimedRequest.dateOfBirth || null,
    avatarUrl: claimedRequest.avatarUrl || null,
    department: departmentId,
    class: !isFacultyRequest ? claimedRequest.class : null,
    isEmailVerified: true,
    isActive: true,
  });
  user.$locals.passwordAlreadyHashed = true;
  try {
    await user.save();
  } catch (error) {
    await releaseClaim();
    if (error?.code === 11000 && error?.keyPattern?.[identifierField]) {
      throw ApiError.conflict(`This ${identifierLabel} already exists. Choose a different one.`);
    }
    throw error;
  }

  try {
    await RegistrationRequest.updateOne(
      { _id: claimedRequest._id, status: 'approved', assignedIdentifier: identifier },
      { $unset: { passwordHash: '' } },
    );
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    await releaseClaim();
    throw error;
  }

  let emailSent = true;
  try {
    await sendAccountCreatedEmail({
      to: claimedRequest.email,
      name: claimedRequest.name,
      role: isFacultyRequest ? 'faculty' : 'student',
      credentialsMessage: `Use the password you selected during registration to sign in. Your assigned ${identifierLabel} is ${identifier}.`,
    });
  } catch (emailError) {
    emailSent = false;
    console.error(`[${req.id || 'no-request-id'}] Registration approval email delivery failed.`);
  }
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.CREATE, targetType: 'RegistrationRequest', targetId: claimedRequest._id, description: `Approved registration request for ${claimedRequest.email}`, ipAddress: req.ip, requestId: req.id });
  const accountLabel = isFacultyRequest ? 'Faculty account' : 'Student account';
  const emailSuffix = emailSent ? '' : ', but the notification email could not be delivered';
  return sendResponse(res, 200, `Registration approved. ${accountLabel} created with assigned ${identifierLabel}${emailSuffix}.`, {
    userId: user._id,
    role: user.role,
    identifier,
    identifierField,
    emailSent,
  });
});

export const rejectRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const request = await RegistrationRequest.findById(req.params.id).select('email status department class');
  if (!request) throw ApiError.notFound('Request not found.');
  await assertRequestScope(req, request);
  if (request.status !== 'pending') throw ApiError.conflict(`Request is already ${request.status}.`);

  const reviewedAt = new Date();
  const rejected = await RegistrationRequest.findOneAndUpdate(
    { _id: request._id, status: 'pending' },
    {
      $set: {
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: req.user._id,
        reviewedAt,
      },
      $unset: { passwordHash: '' },
    },
    { new: true },
  ).select('email status');
  if (!rejected) throw ApiError.conflict('This request was already processed. Refresh the review list.');

  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.UPDATE, targetType: 'RegistrationRequest', targetId: rejected._id, description: `Rejected registration request for ${rejected.email}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Registration request rejected.');
});

export const checkRequestStatus = asyncHandler(async (req, res) => {
  const { code, requestId, statusToken } = req.query;
  const normalizedCode = normalizeStatusCode(code);
  let filter;
  if (normalizedCode) {
    if (!STATUS_CODE_PATTERN.test(normalizedCode)) throw ApiError.badRequest('This status reference is invalid or has expired.');
    filter = { statusCodeHash: hashStatusToken(normalizedCode) };
  } else {
    // Legacy private links remain supported, but malformed IDs are rejected before any Mongoose query.
    if (!mongoose.isValidObjectId(requestId) || typeof statusToken !== 'string' || statusToken.length < 32 || statusToken.length > 128) {
      throw ApiError.badRequest('This status reference is invalid or has expired.');
    }
    filter = { _id: requestId, statusTokenHash: hashStatusToken(statusToken) };
  }
  const request = await RegistrationRequest.findOne(filter).select('status rejectionReason assignedIdentifier createdAt reviewedAt statusTokenExpiresAt');
  if (request?.statusTokenExpiresAt && request.statusTokenExpiresAt <= new Date()) {
    const error = ApiError.gone('This status reference has expired. Please submit a new request if needed.');
    error.code = 'STATUS_LINK_EXPIRED';
    throw error;
  }
  const safeRequest = request
    ? { status: request.status, assignedIdentifier: request.status === 'approved' ? request.assignedIdentifier || null : null, rejectionReason: request.status === 'rejected' ? request.rejectionReason || null : null, createdAt: request.createdAt, reviewedAt: request.reviewedAt }
    : null;
  return sendResponse(res, 200, 'Registration status retrieved.', { request: safeRequest });
});
