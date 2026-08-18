import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import { RegistrationRequest, User, Class } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { sendAccountCreatedEmail } from '../utils/email.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, ROLES } from '../config/constants.js';
import { paginationMeta, parsePagination } from '../utils/pagination.js';

const PASSWORD_HASH_ROUNDS = 12;

function hashStatusToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function assertRequestScope(req, request) {
  if (req.user.role !== ROLES.HOD) return request;
  const classDoc = await Class.findOne({ _id: request.class, department: req.user.department }).select('_id');
  if (!classDoc) throw ApiError.notFound('Request not found.');
  return request;
}

export const submitRequest = asyncHandler(async (req, res) => {
  const { name, email, registerNumber, phone, classId, password } = req.body;
  const normalizedEmail = email.toLowerCase();
  if (await User.findOne({ email: normalizedEmail })) throw ApiError.conflict('An account with this email already exists.');
  const existingRequest = await RegistrationRequest.findOne({ email: normalizedEmail });
  if (existingRequest) throw ApiError.conflict(existingRequest.status === 'pending' ? 'A registration request from this email is already pending review.' : 'A registration request from this email was already processed.');
  const classDoc = await Class.findOne({ _id: classId, isActive: true }).select('_id');
  if (!classDoc) throw ApiError.badRequest('Invalid class selected.');
  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  const statusToken = crypto.randomBytes(32).toString('base64url');
  const request = await RegistrationRequest.create({ name, email: normalizedEmail, registerNumber, phone, class: classId, passwordHash, statusTokenHash: hashStatusToken(statusToken) });
  return sendResponse(res, 201, 'Registration request submitted. Save the private status details below.', { requestId: request._id, status: 'pending', statusToken });
});

export const listRequests = asyncHandler(async (req, res) => {
  const { status = 'pending' } = req.query;
  let filter = status === 'all' ? {} : { status };
  if (req.user.role === ROLES.HOD) {
    const classIds = await Class.distinct('_id', { department: req.user.department || null });
    filter = { ...filter, class: { $in: classIds } };
  }
  const pagination = parsePagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const [requests, total] = await Promise.all([
    RegistrationRequest.find(filter).select('-password -passwordHash -statusTokenHash').populate('class', 'name code department').populate('reviewedBy', 'name').sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    RegistrationRequest.countDocuments(filter),
  ]);
  return sendResponse(res, 200, 'Requests fetched', { requests, pagination: paginationMeta({ total, page: pagination.page, limit: pagination.limit }) });
});

export const approveRequest = asyncHandler(async (req, res) => {
  const request = await RegistrationRequest.findById(req.params.id).select('+passwordHash +statusTokenHash');
  if (!request) throw ApiError.notFound('Request not found.');
  await assertRequestScope(req, request);
  if (request.status !== 'pending') throw ApiError.conflict(`Request is already ${request.status}.`);
  if (!request.passwordHash) throw ApiError.conflict('Registration credentials are no longer available. Ask the student to submit a new request.');
  if (await User.findOne({ email: request.email })) throw ApiError.conflict('An account with this email already exists.');

  const classDoc = await Class.findById(request.class).select('department');
  if (!classDoc) throw ApiError.conflict('The selected class is no longer available.');
  const user = new User({ name: request.name, email: request.email, password: request.passwordHash, role: ROLES.STUDENT, registerNumber: request.registerNumber || undefined, phone: request.phone || undefined, department: classDoc.department, class: request.class, isEmailVerified: true, isActive: true });
  user.$locals.passwordAlreadyHashed = true;
  await user.save();

  request.status = 'approved';
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.passwordHash = undefined;
  request.statusTokenHash = undefined;
  await request.save();
  await sendAccountCreatedEmail({ to: request.email, name: request.name, role: 'student', credentialsMessage: 'Use the password you selected during registration to sign in.' });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.CREATE, targetType: 'RegistrationRequest', targetId: request._id, description: `Approved registration request for ${request.email}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Registration approved. Student account created.', { userId: user._id });
});

export const rejectRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const request = await RegistrationRequest.findById(req.params.id).select('+statusTokenHash');
  if (!request) throw ApiError.notFound('Request not found.');
  await assertRequestScope(req, request);
  if (request.status !== 'pending') throw ApiError.conflict(`Request is already ${request.status}.`);
  request.status = 'rejected';
  request.rejectionReason = reason || '';
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.passwordHash = undefined;
  request.statusTokenHash = undefined;
  await request.save();
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.UPDATE, targetType: 'RegistrationRequest', targetId: request._id, description: `Rejected registration request for ${request.email}`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, 'Registration request rejected.');
});

export const checkRequestStatus = asyncHandler(async (req, res) => {
  const { requestId, statusToken } = req.query;
  const request = await RegistrationRequest.findOne({ _id: requestId, statusTokenHash: hashStatusToken(statusToken) }).select('status rejectionReason createdAt reviewedAt');
  return sendResponse(res, 200, 'If the private request details are valid, the current status is returned.', { request: request || null });
});
