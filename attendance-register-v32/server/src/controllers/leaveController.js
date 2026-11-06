import asyncHandler from 'express-async-handler';
import { Class, LeaveRequest, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { notifyMany, notifyUser } from '../services/notificationService.js';
import { logActivity } from '../services/activityLogService.js';
import { ACTIVITY_ACTION, canonicalRole, LEAVE_STATUS, NOTIFICATION_TYPE, roleValues, ROLES } from '../config/constants.js';

const reviewPopulate = [
  { path: 'student', select: 'name email registerNumber class' },
  { path: 'class', select: 'name code classTeacher' },
  { path: 'tutor', select: 'name email employeeId' },
  { path: 'decidedBy', select: 'name email employeeId role' },
];

function reviewScope(user, classIds) {
  if (canonicalRole(user.role) === ROLES.SUPER_ADMIN) return {};
  return { class: { $in: classIds } };
}

export const createLeaveRequest = asyncHandler(async (req, res) => {
  if (canonicalRole(req.user.role) !== ROLES.USER) throw ApiError.forbidden('Only active Students can submit leave requests.');
  const student = await User.findById(req.user._id).select('class role isActive');
  if (!student?.isActive || canonicalRole(student.role) !== ROLES.USER) throw ApiError.forbidden('Only active Students can submit leave requests.');
  if (!student.class) throw ApiError.badRequest('Your account is not assigned to a class. Contact the HOD.');
  const classDoc = await Class.findOne({ _id: student.class, isActive: true }).select('_id classTeacher');
  if (!classDoc) throw ApiError.badRequest('Your assigned class is no longer active. Contact the HOD.');

  const request = await LeaveRequest.create({
    student: student._id,
    class: classDoc._id,
    tutor: classDoc.classTeacher || null,
    reason: req.body.reason,
  });

  const hods = await User.find({ role: { $in: roleValues(ROLES.SUPER_ADMIN) }, isActive: true }).select('_id').lean();
  const recipients = [...new Set([classDoc.classTeacher, ...hods.map((hod) => hod._id)].filter(Boolean).map(String))];
  if (recipients.length) {
    await notifyMany({
      userIds: recipients,
      type: NOTIFICATION_TYPE.LEAVE_REQUEST,
      title: 'New leave request',
      message: 'A Student in your authorized class scope submitted a leave request for review.',
      meta: { leaveRequestId: request._id, classId: classDoc._id },
    });
  }
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.LEAVE_REQUEST, targetType: 'LeaveRequest', targetId: request._id, description: `Submitted a leave request for class ${classDoc._id}`, ipAddress: req.ip, requestId: req.id });
  await request.populate(reviewPopulate);
  return sendResponse(res, 201, 'Leave request submitted to your tutor and HOD.', { request });
});

export const listLeaveRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  if (status && !Object.values(LEAVE_STATUS).includes(status)) throw ApiError.badRequest('Invalid leave-request status.');
  let filter = status ? { status } : {};
  const actorRole = canonicalRole(req.user.role);
  if (actorRole === ROLES.USER) filter.student = req.user._id;
  else if (actorRole === ROLES.ADMIN) {
    const classIds = await Class.distinct('_id', { classTeacher: req.user._id, isActive: true });
    filter = { ...filter, ...reviewScope(req.user, classIds) };
  } else if (actorRole !== ROLES.SUPER_ADMIN) {
    filter._id = null;
  }
  const requests = await LeaveRequest.find(filter).populate(reviewPopulate).sort({ createdAt: -1 }).limit(100).lean();
  return sendResponse(res, 200, 'Leave requests fetched', { requests });
});

export const decideLeaveRequest = asyncHandler(async (req, res) => {
  const { status, decisionReason } = req.body;
  if (status === LEAVE_STATUS.REJECTED && !decisionReason?.trim()) throw ApiError.badRequest('A rejection reason is required.');
  const request = await LeaveRequest.findById(req.params.id).select('+student +class +tutor +status +decisionReason +decidedBy +decidedAt');
  if (!request) throw ApiError.notFound('Leave request not found.');
  if (request.status !== LEAVE_STATUS.PENDING) throw ApiError.conflict('This leave request has already been decided.');

  if (canonicalRole(req.user.role) === ROLES.ADMIN) {
    const classDoc = await Class.findOne({ _id: request.class, classTeacher: req.user._id, isActive: true }).select('_id');
    if (!classDoc) throw ApiError.forbidden('Only the current tutor can decide leave requests for this class.');
  } else if (canonicalRole(req.user.role) !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only the assigned tutor or HOD can decide leave requests.');
  }

  const updated = await LeaveRequest.findOneAndUpdate(
    { _id: request._id, status: LEAVE_STATUS.PENDING },
    { $set: { status, decisionReason: status === LEAVE_STATUS.REJECTED ? decisionReason.trim() : null, decidedBy: req.user._id, decidedAt: new Date() } },
    { new: true, runValidators: true },
  ).populate(reviewPopulate);
  if (!updated) throw ApiError.conflict('This leave request was decided by another authorized reviewer.');

  await notifyUser({
    userId: request.student,
    type: NOTIFICATION_TYPE.LEAVE_REQUEST,
    title: status === LEAVE_STATUS.APPROVED ? 'Leave request approved' : 'Leave request rejected',
    message: status === LEAVE_STATUS.APPROVED ? 'Your leave request was approved.' : `Your leave request was rejected: ${decisionReason.trim()}`,
    meta: { leaveRequestId: request._id, status },
  });
  await logActivity({ actorId: req.user._id, action: ACTIVITY_ACTION.LEAVE_DECISION, targetType: 'LeaveRequest', targetId: request._id, description: `${status === LEAVE_STATUS.APPROVED ? 'Approved' : 'Rejected'} a leave request`, ipAddress: req.ip, requestId: req.id });
  return sendResponse(res, 200, `Leave request ${status}.`, { request: updated });
});
