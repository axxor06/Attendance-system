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
import { notifyRegistrationSubmitted, resolveRegistrationNotifications } from '../services/notificationService.js';
import { getRegistrationSummary } from '../services/badgeService.js';
import { escapeRegex } from '../utils/messagingAuthorization.js';
import { normalizeExperience, normalizeFacultyEducation, normalizeStudentEducation } from '../utils/registrationProfile.js';
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

/**
 * Single choke point for "may this reviewer act on this request?".
 * HOD is the institution-wide approval tier in this product's role model
 * (see ARCHITECTURE.md, "Role and scope model"), so every HOD may review every
 * request. Anyone else gets a 404 so request ids cannot be probed. If the
 * hierarchy ever gains department-scoped HODs, this is the one place to change.
 */
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

  // Role-specific profile data. Fields for the other role are rejected outright
  // so an applicant cannot smuggle data into a section that does not apply.
  let profile;
  if (role === ROLES.STUDENT) {
    if (req.body.facultyEducation !== undefined || req.body.experience !== undefined) {
      throw ApiError.badRequest('Faculty education and experience do not apply to a student request.');
    }
    profile = { previousEducation: normalizeStudentEducation(req.body.previousEducation) };
  } else {
    if (req.body.previousEducation !== undefined) {
      throw ApiError.badRequest('Previous education details apply to student requests only.');
    }
    profile = {
      facultyEducation: normalizeFacultyEducation(req.body.facultyEducation),
      experience: normalizeExperience(req.body.experience),
    };
  }

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
  let request;
  try {
    request = await RegistrationRequest.create({
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
      ...profile,
      passwordHash,
      statusCodeHash: hashStatusToken(statusCode),
      statusTokenExpiresAt: new Date(Date.now() + STATUS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      history: [{ status: 'pending', at: new Date() }],
    });
  } catch (error) {
    // Two simultaneous submissions for one email: the unique index decides.
    if (error?.code === 11000) throw ApiError.conflict('A registration request from this email is already pending review.');
    throw error;
  }

  // The request is the source of truth for the pending count. The notification is
  // idempotent (unique per HOD + request) and must never fail the applicant's submission.
  try {
    await notifyRegistrationSubmitted(request);
  } catch (notificationError) {
    console.error(`[${req.id || 'no-request-id'}] Registration notification failed: ${notificationError.message}`);
  }
  return sendResponse(res, 201, 'Registration request submitted. Save the private status reference below.', { status: 'pending', statusCode });
});

const REQUEST_LIST_FIELDS = '_id name email requestedRole phone dateOfBirth avatarUrl department class previousEducation facultyEducation experience status rejectionReason assignedIdentifier reviewedBy reviewedAt history createdAt updatedAt';

function populateRequest(query) {
  return query
    .populate({ path: 'class', select: 'name code department semester', populate: { path: 'semester', select: 'number label' } })
    .populate('department', 'name code')
    .populate('reviewedBy', 'name');
}

export const listRequests = asyncHandler(async (req, res) => {
  const { status = 'pending', role, search, departmentId, classId, sort = 'newest' } = req.query;
  if (!['pending', 'approved', 'rejected', 'all'].includes(status)) throw ApiError.badRequest('Unsupported status filter.');
  const filter = status === 'all' ? {} : { status };
  if (role !== undefined) {
    if (!['student', 'faculty'].includes(role)) throw ApiError.badRequest('Role filter must be student or faculty.');
    filter.requestedRole = { $in: role === 'faculty' ? [ROLES.ADMIN, 'faculty'] : [ROLES.USER, 'student'] };
  }
  if (departmentId) filter.department = departmentId;
  if (classId) filter.class = classId;
  const term = typeof search === 'string' ? search.trim().slice(0, 80) : '';
  if (term) {
    const expression = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: expression }, { email: expression }];
  }
  const pagination = parsePagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const order = sort === 'oldest' ? 1 : -1;
  const [requests, total, summary] = await Promise.all([
    populateRequest(RegistrationRequest.find(filter).select(REQUEST_LIST_FIELDS))
      .sort({ createdAt: order, _id: order })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    RegistrationRequest.countDocuments(filter),
    getRegistrationSummary(),
  ]);
  return sendResponse(res, 200, 'Requests fetched', { requests, summary, pagination: paginationMeta({ total, page: pagination.page, limit: pagination.limit }) });
});

export const getRequest = asyncHandler(async (req, res) => {
  const request = await populateRequest(RegistrationRequest.findById(req.params.id).select(REQUEST_LIST_FIELDS)).lean();
  if (!request) throw ApiError.notFound('Request not found.');
  await assertRequestScope(req, request);
  return sendResponse(res, 200, 'Request fetched', { request });
});

export const getRequestSummary = asyncHandler(async (_req, res) => {
  return sendResponse(res, 200, 'Registration summary fetched', await getRegistrationSummary());
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
    {
      $set: { status: 'approved', assignedIdentifier: identifier, reviewedBy: req.user._id, reviewedAt: new Date() },
      $push: { history: { status: 'approved', by: req.user._id, at: new Date(), note: '' } },
    },
    { new: true },
  ).select('+passwordHash');
  if (!claimedRequest) throw ApiError.conflict('This request was already processed. Refresh the review list.');

  const releaseClaim = async () => {
    await RegistrationRequest.updateOne(
      { _id: claimedRequest._id, status: 'approved', assignedIdentifier: identifier },
      {
        $set: { status: 'pending' },
        $unset: { assignedIdentifier: '', reviewedBy: '', reviewedAt: '' },
        $pop: { history: 1 },
      },
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
    previousEducation: claimedRequest.previousEducation || undefined,
    facultyEducation: claimedRequest.facultyEducation || undefined,
    experience: claimedRequest.experience || undefined,
    qualification: isFacultyRequest ? claimedRequest.facultyEducation?.qualification || undefined : undefined,
    createdBy: req.user._id,
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
  await resolveRegistrationNotifications(claimedRequest._id, 'approved').catch(() => {});
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.REGISTRATION_DECISION, targetType: 'RegistrationRequest', targetId: claimedRequest._id, description: `Approved registration request for ${claimedRequest.email}`, ipAddress: req.ip, requestId: req.id });
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
      $push: { history: { status: 'rejected', by: req.user._id, at: reviewedAt, note: reason } },
      $unset: { passwordHash: '' },
    },
    { new: true },
  ).select('email status');
  if (!rejected) throw ApiError.conflict('This request was already processed. Refresh the review list.');

  await resolveRegistrationNotifications(rejected._id, 'rejected').catch(() => {});
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.REGISTRATION_DECISION, targetType: 'RegistrationRequest', targetId: rejected._id, description: `Rejected registration request for ${rejected.email}`, ipAddress: req.ip, requestId: req.id });
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
