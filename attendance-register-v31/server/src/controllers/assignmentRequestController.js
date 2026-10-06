import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { AssignmentRequest, Timetable, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { notifyMany, notifyUser } from '../services/notificationService.js';
import { findFacultyAssignmentConflicts } from '../services/timetableService.js';
import { logActivity } from '../services/activityLogService.js';
import {
  ACTIVITY_ACTION,
  ASSIGNMENT_REQUEST_STATUS,
  canonicalRole,
  NOTIFICATION_TYPE,
  PERIOD_KIND,
  roleValues,
  ROLES,
} from '../config/constants.js';

const reviewPopulate = [
  { path: 'timetable', select: 'class days' },
  { path: 'class', select: 'name code department semester classTeacher' },
  { path: 'subject', select: 'name code class' },
  { path: 'faculty', select: 'name email employeeId department' },
  { path: 'replacementFaculty', select: 'name email employeeId department' },
  { path: 'decidedBy', select: 'name email employeeId role' },
];

function findSlot(timetable, dayOfWeek, slotId) {
  const day = (timetable?.days || []).find((entry) => entry.dayOfWeek === dayOfWeek);
  const slot = (day?.slots || []).find((entry) => String(entry._id) === String(slotId));
  return { day, slot };
}

async function loadExactSlot({ timetableId, dayOfWeek, slotId, session = null }) {
  const query = Timetable.findOne({ _id: timetableId, isActive: true }).select('_id class days').lean();
  if (session) query.session(session);
  const timetable = await query;
  const { day, slot } = findSlot(timetable, dayOfWeek, slotId);
  return { timetable, day, slot };
}

async function assertCurrentFacultyAssignment(req) {
  if (canonicalRole(req.user.role) !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only the Faculty currently assigned to a timetable slot can report an inability.');
  }
  const { timetableId, dayOfWeek, slotId } = req.body;
  const assignment = await loadExactSlot({ timetableId, dayOfWeek, slotId });
  if (!assignment.timetable || !assignment.day || !assignment.slot) throw ApiError.notFound('The selected timetable slot no longer exists.');
  if (assignment.slot.kind !== PERIOD_KIND.CLASS || !assignment.slot.subject || !assignment.slot.faculty) {
    throw ApiError.badRequest('Only an active class period with a Faculty assignment can be reported.');
  }
  if (String(assignment.slot.faculty) !== String(req.user._id)) {
    throw ApiError.forbidden('You can report inability only for your own current timetable assignment.');
  }
  return assignment;
}

function decisionMessage(status) {
  return status === ASSIGNMENT_REQUEST_STATUS.ACCEPTED
    ? 'Your timetable inability request was accepted and a replacement Faculty member was assigned.'
    : 'Your timetable inability request was rejected by the HOD.';
}

export const createAssignmentRequest = asyncHandler(async (req, res) => {
  const { timetableId, dayOfWeek, slotId, reason } = req.body;
  const { timetable, slot } = await assertCurrentFacultyAssignment(req);

  const pending = await AssignmentRequest.findOne({
    timetable: timetable._id,
    slotId,
    status: ASSIGNMENT_REQUEST_STATUS.PENDING,
  }).select('_id').lean();
  if (pending) throw ApiError.conflict('A pending inability request already exists for this timetable slot.');

  let request;
  try {
    request = await AssignmentRequest.create({
      timetable: timetable._id,
      class: timetable.class,
      dayOfWeek,
      slotId,
      order: slot.order,
      subject: slot.subject,
      faculty: req.user._id,
      reason,
    });
  } catch (error) {
    if (error?.code === 11000) throw ApiError.conflict('A pending inability request already exists for this timetable slot.');
    throw error;
  }

  const hods = await User.find({ role: { $in: roleValues(ROLES.SUPER_ADMIN) }, isActive: true }).select('_id').lean();
  if (hods.length) {
    await notifyMany({
      userIds: hods.map((hod) => hod._id),
      type: NOTIFICATION_TYPE.ASSIGNMENT_REQUEST,
      title: 'Faculty assignment request needs review',
      message: 'A Faculty member reported that they cannot take an assigned timetable slot.',
      meta: { assignmentRequestId: request._id, classId: timetable.class, dayOfWeek, order: slot.order },
    });
  }
  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.ASSIGNMENT_REQUEST,
    targetType: 'AssignmentRequest',
    targetId: request._id,
    description: `Reported inability for timetable slot ${slot.order} on ${dayOfWeek}`,
    reason,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
  });

  await request.populate(reviewPopulate);
  return sendResponse(res, 201, 'Inability request sent to the HOD.', { request });
});

export const listAssignmentRequests = asyncHandler(async (req, res) => {
  const actorRole = canonicalRole(req.user.role);
  if (![ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(actorRole)) throw ApiError.forbidden('Only HOD and Faculty can view assignment requests.');
  const { status } = req.query;
  if (status && !Object.values(ASSIGNMENT_REQUEST_STATUS).includes(status)) throw ApiError.badRequest('Invalid assignment-request status.');

  const filter = status ? { status } : {};
  if (actorRole === ROLES.ADMIN) filter.faculty = req.user._id;
  const requests = await AssignmentRequest.find(filter)
    .populate(reviewPopulate)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return sendResponse(res, 200, 'Assignment requests fetched', { requests });
});

export const decideAssignmentRequest = asyncHandler(async (req, res) => {
  if (canonicalRole(req.user.role) !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Only an authorized HOD can decide assignment requests.');
  const { status, replacementFaculty, decisionReason } = req.body;
  const request = await AssignmentRequest.findById(req.params.id).select('+timetable +class +dayOfWeek +slotId +order +subject +faculty +status');
  if (!request) throw ApiError.notFound('Assignment request not found.');
  if (request.status !== ASSIGNMENT_REQUEST_STATUS.PENDING) throw ApiError.conflict('This assignment request has already been decided.');

  if (status === ASSIGNMENT_REQUEST_STATUS.REJECTED) {
    const updated = await AssignmentRequest.findOneAndUpdate(
      { _id: request._id, status: ASSIGNMENT_REQUEST_STATUS.PENDING },
      { $set: { status, decisionReason: decisionReason.trim(), decidedBy: req.user._id, decidedAt: new Date() } },
      { new: true, runValidators: true },
    ).populate(reviewPopulate);
    if (!updated) throw ApiError.conflict('This assignment request was decided by another authorized reviewer.');
    await notifyUser({
      userId: request.faculty,
      type: NOTIFICATION_TYPE.ASSIGNMENT_REQUEST,
      title: 'Assignment request rejected',
      message: decisionMessage(status),
      meta: { assignmentRequestId: request._id, status },
    });
    await logActivity({
      actorId: req.user._id,
      action: ACTIVITY_ACTION.ASSIGNMENT_DECISION,
      targetType: 'AssignmentRequest',
      targetId: request._id,
      description: 'Rejected a Faculty timetable inability request',
      reason: decisionReason.trim(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
    return sendResponse(res, 200, 'Assignment request rejected; the current Faculty assignment remains unchanged.', { request: updated });
  }

  if (String(replacementFaculty) === String(request.faculty)) throw ApiError.badRequest('Choose a different active Faculty member as the replacement.');
  const replacement = await User.findOne({
    _id: replacementFaculty,
    role: { $in: roleValues(ROLES.ADMIN) },
    isActive: true,
  }).select('_id name email employeeId department').lean();
  if (!replacement) throw ApiError.badRequest('The replacement Faculty member is not active or is not a Faculty account.');

  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const { timetable, slot } = await loadExactSlot({
        timetableId: request.timetable,
        dayOfWeek: request.dayOfWeek,
        slotId: request.slotId,
        session,
      });
      if (!timetable || !slot || slot.kind !== PERIOD_KIND.CLASS) throw ApiError.conflict('This timetable slot was removed or changed; submit a new request if needed.');
      if (String(slot.faculty) !== String(request.faculty) || String(slot.subject) !== String(request.subject) || Number(slot.order) !== Number(request.order)) {
        throw ApiError.conflict('This timetable slot has changed since the request was submitted; no replacement was made.');
      }

      const conflicts = await findFacultyAssignmentConflicts({
        facultyId: replacement._id,
        dayOfWeek: request.dayOfWeek,
        slot,
        excludeTimetableId: request.timetable,
        excludeSlotId: request.slotId,
        session,
      });
      if (conflicts.length) throw ApiError.conflict('The selected replacement Faculty is no longer free for this exact slot.', conflicts);

      const timetableUpdate = await Timetable.findOneAndUpdate(
        {
          _id: request.timetable,
          isActive: true,
          'days.dayOfWeek': request.dayOfWeek,
          'days.slots._id': request.slotId,
          'days.slots.faculty': request.faculty,
          'days.slots.subject': request.subject,
        },
        { $set: { 'days.$[day].slots.$[slot].faculty': replacement._id, updatedBy: req.user._id } },
        {
          arrayFilters: [
            { 'day.dayOfWeek': request.dayOfWeek },
            { 'slot._id': request.slotId, 'slot.faculty': request.faculty, 'slot.subject': request.subject },
          ],
          new: true,
          runValidators: true,
          session,
        },
      );
      if (!timetableUpdate) throw ApiError.conflict('The timetable slot changed before replacement could be committed.');

      updated = await AssignmentRequest.findOneAndUpdate(
        { _id: request._id, status: ASSIGNMENT_REQUEST_STATUS.PENDING },
        { $set: { status, replacementFaculty: replacement._id, decisionReason: null, decidedBy: req.user._id, decidedAt: new Date() } },
        { new: true, runValidators: true, session },
      );
      if (!updated) throw ApiError.conflict('This assignment request was decided by another authorized reviewer.');
    });
  } finally {
    await session.endSession();
  }

  await notifyUser({
    userId: request.faculty,
    type: NOTIFICATION_TYPE.ASSIGNMENT_REQUEST,
    title: 'Assignment request accepted',
    message: decisionMessage(status),
    meta: { assignmentRequestId: request._id, status, replacementFaculty: replacement._id },
  });
  await notifyUser({
    userId: replacement._id,
    type: NOTIFICATION_TYPE.ASSIGNMENT_REQUEST,
    title: 'New timetable assignment',
    message: 'The HOD assigned you a class period after an approved Faculty inability request.',
    meta: { assignmentRequestId: request._id, classId: request.class, dayOfWeek: request.dayOfWeek, order: request.order },
  });
  await logActivity({
    actorId: req.user._id,
    action: ACTIVITY_ACTION.ASSIGNMENT_DECISION,
    targetType: 'AssignmentRequest',
    targetId: request._id,
    description: 'Accepted a Faculty timetable inability request and assigned a replacement Faculty member',
    reason: decisionReason?.trim() || null,
    oldValue: { faculty: request.faculty, timetable: request.timetable, slotId: request.slotId },
    newValue: { faculty: replacement._id, timetable: request.timetable, slotId: request.slotId },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
  });

  await updated.populate(reviewPopulate);
  return sendResponse(res, 200, 'Assignment request accepted and timetable replacement committed.', { request: updated });
});
