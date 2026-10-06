import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { Attendance, Class, Conversation, Message, Notification, Subject, User } from '../models/index.js';
import { ACTIVITY_ACTION, NOTIFICATION_TYPE, canonicalRole, roleValues } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { logActivity } from '../services/activityLogService.js';
import { notifyUser } from '../services/notificationService.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { getFacultyTimetableAccessIds } from '../services/timetableService.js';
import { getOverallAttendance, getSubjectWiseAttendance } from '../services/attendanceService.js';
import { calculateAge } from '../utils/dateOfBirth.js';
import {
  assertMessagingRecipient,
  escapeRegex,
  getAllowedMessagingRecipientIds,
  messageUserProjection,
  participantKeyFor,
} from '../utils/messagingAuthorization.js';

function idString(value) {
  return value?._id?.toString?.() || value?.toString?.();
}

function roleLabel(role) {
  const canonical = canonicalRole(role);
  if (canonical === 'super_admin') return 'HOD';
  if (canonical === 'admin') return 'Faculty';
  return 'Student';
}

function safeMessage(message) {
  return {
    _id: message._id,
    conversation: message.conversation,
    sender: message.sender?._id || message.sender,
    recipient: message.recipient,
    body: message.body,
    editedAt: message.editedAt || null,
    readAt: message.readAt || null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

function safeConversation(conversation, actorId, unreadCount = 0, visibleLastMessage, recipientIsTutor = false) {
  const other = (conversation.participants || []).find((participant) => idString(participant) !== idString(actorId));
  const recipient = messageUserProjection(other);
  if (recipient) recipient.isTutor = Boolean(recipientIsTutor);
  const lastMessage = visibleLastMessage === undefined
    ? (conversation.lastMessageAt ? { preview: conversation.lastMessagePreview || '', sentAt: conversation.lastMessageAt, sender: conversation.lastSender } : null)
    : (visibleLastMessage ? { preview: String(visibleLastMessage.body || '').slice(0, 180), sentAt: visibleLastMessage.createdAt, sender: visibleLastMessage.sender?._id || visibleLastMessage.sender } : null);
  return {
    _id: conversation._id,
    recipient,
    lastMessage,
    unreadCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

async function loadConversationForMember(conversationId, actorId) {
  const conversation = await Conversation.findOne({ _id: conversationId, participants: actorId })
    .populate('participants', '_id name email role avatarUrl employeeId registerNumber class department')
    .populate({ path: 'participants.class', select: '_id name code semester', populate: { path: 'semester', select: '_id number label' } })
    .populate('participants.department', '_id name code')
    .lean();
  if (!conversation) throw ApiError.notFound('Conversation not found.');
  return conversation;
}

export const listMessageRecipients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 25, maxLimit: 50 });
  const allowedIds = await getAllowedMessagingRecipientIds(req.user);
  const search = String(req.query.search || '').trim();
  const group = String(req.query.group || 'all').trim();
  let groupIds = allowedIds;
  if (group === 'students' || group === 'faculty' || group === 'hod') {
    const role = group === 'students' ? 'user' : group === 'faculty' ? 'admin' : 'super_admin';
    const roleIds = await User.find({ _id: { $in: allowedIds }, role: { $in: roleValues(role) }, isActive: true }).select('_id').lean();
    groupIds = roleIds.map((user) => user._id);
  } else if (group === 'tutors') {
    const tutorRows = await Class.find({ isActive: true, classTeacher: { $in: allowedIds } }).select('classTeacher').lean();
    const tutorIds = new Set(tutorRows.map((row) => idString(row.classTeacher)));
    groupIds = allowedIds.filter((id) => tutorIds.has(String(id)));
  }
  const filter = { _id: { $in: groupIds }, isActive: true };
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: expression }, { email: expression }, { employeeId: expression }, { registerNumber: expression }];
  }
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('_id name email role avatarUrl employeeId registerNumber class department')
      .populate({ path: 'class', select: '_id name code semester', populate: { path: 'semester', select: '_id number label' } })
      .populate('department', '_id name code')
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);
  const tutorRows = users.length
    ? await Class.find({ isActive: true, classTeacher: { $in: users.map((user) => user._id) } }).select('classTeacher name code').lean()
    : [];
  const tutorIds = new Set(tutorRows.map((row) => idString(row.classTeacher)));
  const recipients = users.map((user) => {
    const role = canonicalRole(user.role);
    const groups = [];
    if (role === 'user') groups.push('students');
    if (role === 'admin') groups.push('faculty');
    if (role === 'super_admin') groups.push('hod');
    if (tutorIds.has(idString(user._id))) groups.push('tutors');
    return {
      ...messageUserProjection(user),
      roleLabel: roleLabel(user.role),
      groups,
      isTutor: tutorIds.has(idString(user._id)),
    };
  });
  return sendResponse(res, 200, 'Message recipients fetched.', { recipients, pagination: paginationMeta({ total, page, limit }) });
});

export const getMessageProfile = asyncHandler(async (req, res) => {
  const recipient = await assertMessagingRecipient(req.user, req.params.userId);
  const user = await User.findOne({ _id: recipient._id, isActive: true })
    .select('_id name email role phone dateOfBirth designation qualification admissionYear employeeId registerNumber avatarUrl class department lastLoginAt deviceBoundAt')
    .populate({ path: 'class', select: '_id name code semester', populate: { path: 'semester', select: '_id number label' } })
    .populate('department', '_id name code')
    .lean();
  if (!user) throw ApiError.notFound('The selected account is not available.');
  await assertMessagingRecipient(req.user, user._id);
  const profile = {
    ...messageUserProjection(user),
    phone: user.phone || null,
    dateOfBirth: user.dateOfBirth || null,
    age: user.dateOfBirth ? calculateAge(user.dateOfBirth) : null,
    designation: user.designation || null,
    qualification: user.qualification || null,
    admissionYear: user.admissionYear || null,
    lastLoginAt: user.lastLoginAt || null,
  };
  const role = canonicalRole(user.role);
  const actorRole = canonicalRole(req.user.role);
  if (role === 'user' && actorRole === 'super_admin') {
    const [overall, subjectWise, recentAttendance] = await Promise.all([
      getOverallAttendance({ studentId: user._id }),
      getSubjectWiseAttendance({ studentId: user._id }),
      Attendance.find({ student: user._id }).select('date periodOrder periodName subject class status remarks markedAt editedAt').populate('subject', 'name code').sort({ date: -1, periodOrder: 1 }).limit(20).lean(),
    ]);
    profile.attendance = { overall, subjectWise, recent: recentAttendance };
    profile.deviceStatus = { bound: Boolean(user.deviceBoundAt), boundAt: user.deviceBoundAt || null };
  }
  if (role === 'admin') {
    const { subjectIds: timetableSubjectIds, classIds: timetableClassIds } = await getFacultyTimetableAccessIds(user._id);
    const [subjects, timetableClasses, tutorClasses] = await Promise.all([
      Subject.find({
        isActive: true,
        $or: [{ faculty: user._id }, { _id: { $in: timetableSubjectIds } }],
      }).select('_id name code class').populate('class', '_id name code').sort({ name: 1 }).limit(100).lean(),
      timetableClassIds.length
        ? Class.find({ _id: { $in: timetableClassIds }, isActive: true }).select('_id name code department semester').populate('department', '_id name code').populate('semester', '_id number label').sort({ name: 1 }).limit(100).lean()
        : [],
      Class.find({ classTeacher: user._id, isActive: true }).select('_id name code department semester').populate('department', '_id name code').populate('semester', '_id number label').sort({ name: 1 }).limit(100).lean(),
    ]);
    profile.assignedSubjects = subjects;
    profile.assignedClasses = [...new Map([
      ...subjects.filter((subject) => subject.class).map((subject) => subject.class),
      ...timetableClasses,
    ].map((classDoc) => [String(classDoc._id), classDoc])).values()];
    profile.tutorClasses = tutorClasses;
    profile.isTutor = tutorClasses.length > 0;
  }
  return sendResponse(res, 200, 'Message profile fetched.', { profile });
});

export const createConversation = asyncHandler(async (req, res) => {
  const recipient = await assertMessagingRecipient(req.user, req.body.recipientId);
  const actorId = idString(req.user._id);
  const key = participantKeyFor(actorId, recipient._id);
  if (!key || key.split(':').length !== 2) throw ApiError.badRequest('A valid recipient is required.');
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(
      { participantKey: key },
      { $setOnInsert: { participants: [actorId, recipient._id], participantKey: key } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).populate('participants', '_id name email role avatarUrl employeeId registerNumber class department');
  } catch (error) {
    if (error?.code !== 11000) throw error;
    conversation = await Conversation.findOne({ participantKey: key }).populate('participants', '_id name email role avatarUrl employeeId registerNumber class department');
  }
  if (!conversation) throw ApiError.conflict('The conversation could not be created. Please try again.');
  return sendResponse(res, 200, 'Conversation ready.', { conversation: safeConversation(conversation, actorId) });
});

export const listConversations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const actorId = idString(req.user._id);
  const filter = { participants: actorId };
  const [total, conversations] = await Promise.all([
    Conversation.countDocuments(filter),
    Conversation.find(filter)
      .populate('participants', '_id name email role avatarUrl employeeId registerNumber class department')
      .sort({ lastMessageAt: -1, updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);
  const ids = conversations.map((conversation) => conversation._id);
  const actorObjectId = new mongoose.Types.ObjectId(actorId);
  const [unreadRows, visibleLastRows] = ids.length
    ? await Promise.all([
        Message.aggregate([
          { $match: { conversation: { $in: ids }, recipient: actorObjectId, readAt: null, hiddenFor: { $ne: actorObjectId } } },
          { $group: { _id: '$conversation', count: { $sum: 1 } } },
        ]),
        Message.aggregate([
          { $match: { conversation: { $in: ids }, hiddenFor: { $ne: actorObjectId } } },
          { $sort: { createdAt: -1, _id: -1 } },
          { $group: { _id: '$conversation', body: { $first: '$body' }, createdAt: { $first: '$createdAt' }, sender: { $first: '$sender' } } },
        ]),
      ])
    : [[], []];
  const unreadByConversation = new Map(unreadRows.map((row) => [String(row._id), row.count]));
  const visibleLastByConversation = new Map(visibleLastRows.map((row) => [String(row._id), row]));
  const otherParticipantIds = conversations
    .map((conversation) => conversation.participants.find((participant) => idString(participant) !== actorId))
    .map((participant) => participant && participant._id)
    .filter(Boolean);
  const tutorRows = otherParticipantIds.length
    ? await Class.find({ isActive: true, classTeacher: { $in: otherParticipantIds } }).select('classTeacher').lean()
    : [];
  const tutorIds = new Set(tutorRows.map((row) => idString(row.classTeacher)));
  return sendResponse(res, 200, 'Conversations fetched.', {
    conversations: conversations.map((conversation) => {
      const other = conversation.participants.find((participant) => idString(participant) !== actorId);
      return safeConversation(conversation, actorId, unreadByConversation.get(String(conversation._id)) || 0, visibleLastByConversation.get(String(conversation._id)) || null, tutorIds.has(idString(other)));
    }),
    pagination: paginationMeta({ total, page, limit }),
  });
});

export const listConversationMessages = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30, maxLimit: 50 });
  const actorId = idString(req.user._id);
  const conversation = await loadConversationForMember(req.params.conversationId, actorId);
  const filter = { conversation: conversation._id, hiddenFor: { $ne: actorId } };
  const [total, messages] = await Promise.all([
    Message.countDocuments(filter),
    Message.find(filter)
      .populate('sender', '_id name email role avatarUrl')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);
  messages.reverse();
  return sendResponse(res, 200, 'Messages fetched.', {
    conversation: safeConversation(conversation, actorId, 0, messages.at(-1) || null),
    messages: messages.map(safeMessage),
    pagination: paginationMeta({ total, page, limit }),
  });
});

export const sendConversationMessage = asyncHandler(async (req, res) => {
  const actorId = idString(req.user._id);
  const conversation = await loadConversationForMember(req.params.conversationId, actorId);
  const recipient = conversation.participants.find((participant) => idString(participant) !== actorId);
  if (!recipient) throw ApiError.conflict('This direct conversation has an invalid participant set.');
  await assertMessagingRecipient(req.user, recipient._id);

  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) throw ApiError.badRequest('Write a message before sending.');
  if (body.length > 5000) throw ApiError.badRequest('Message text may not exceed 5000 characters.');

  const message = await Message.create({
    conversation: conversation._id,
    sender: actorId,
    recipient: recipient._id,
    body,
  });
  await Conversation.updateOne(
    { _id: conversation._id, participants: actorId },
    {
      $set: {
        lastMessagePreview: body.slice(0, 180),
        lastMessageAt: message.createdAt,
        lastSender: actorId,
      },
    },
  );

  const safe = safeMessage(message);
  await notifyUser({
    userId: recipient._id,
    type: NOTIFICATION_TYPE.MESSAGE,
    title: 'New message',
    message: 'You have a new message in Attendance Register.',
    meta: { conversationId: conversation._id, messageId: message._id },
  });
  await logActivity({
    actorId,
    action: ACTIVITY_ACTION.MESSAGE_SENT,
    targetType: 'Conversation',
    targetId: conversation._id,
    description: 'Sent a direct message',
    newValue: { messageId: message._id, recipientId: recipient._id },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
  });
  return sendResponse(res, 201, 'Message sent.', { message: safe });
});

async function refreshConversationPreview(conversationId, actorId) {
  const latest = await Message.findOne({ conversation: conversationId, hiddenFor: { $ne: actorId } }).sort({ createdAt: -1, _id: -1 }).select('body createdAt sender').lean();
  await Conversation.updateOne(
    { _id: conversationId, participants: actorId },
    latest
      ? { $set: { lastMessagePreview: latest.body.slice(0, 180), lastMessageAt: latest.createdAt, lastSender: latest.sender } }
      : { $set: { lastMessagePreview: '', lastMessageAt: null, lastSender: null } },
  );
}

export const editConversationMessage = asyncHandler(async (req, res) => {
  const actorId = idString(req.user._id);
  const conversation = await loadConversationForMember(req.params.conversationId, actorId);
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) throw ApiError.badRequest('Write a message before saving the edit.');
  if (body.length > 5000) throw ApiError.badRequest('Message text may not exceed 5000 characters.');
  const message = await Message.findOne({ _id: req.params.messageId, conversation: conversation._id, sender: actorId });
  if (!message) throw ApiError.notFound('Message not found or you do not own it.');
  message.body = body;
  message.editedAt = new Date();
  await message.save();
  await refreshConversationPreview(conversation._id, actorId);
  await logActivity({ actorId, action: ACTIVITY_ACTION.UPDATE, targetType: 'Message', targetId: message._id, description: 'Edited a direct message', ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.id });
  return sendResponse(res, 200, 'Message edited.', { message: safeMessage(message) });
});

export const deleteConversationMessage = asyncHandler(async (req, res) => {
  const actorId = idString(req.user._id);
  const mode = req.body.mode;
  const conversation = await loadConversationForMember(req.params.conversationId, actorId);
  const message = await Message.findOne({ _id: req.params.messageId, conversation: conversation._id });
  if (!message) throw ApiError.notFound('Message not found.');

  if (mode === 'me') {
    const alreadyHidden = (message.hiddenFor || []).some((userId) => String(userId) === actorId);
    if (!alreadyHidden) {
      await Message.updateOne(
        { _id: message._id, conversation: conversation._id },
        { $addToSet: { hiddenFor: actorId } },
      );
    }
    await Notification.deleteMany({ user: actorId, type: NOTIFICATION_TYPE.MESSAGE, 'meta.messageId': message._id });
    await logActivity({ actorId, action: ACTIVITY_ACTION.DELETE, targetType: 'Message', targetId: message._id, description: 'Deleted a direct message for self', ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.id });
    return sendResponse(res, 200, 'Message deleted for you.', { messageId: message._id, conversationId: conversation._id, mode, deleted: true });
  }

  if (mode !== 'everyone') throw ApiError.badRequest('Choose whether to delete the message for you or everyone.');
  if (String(message.sender) !== actorId) throw ApiError.notFound('Message not found or you do not own it.');
  await Message.deleteOne({ _id: message._id, conversation: conversation._id, sender: actorId });
  await Notification.deleteMany({ user: message.recipient, type: NOTIFICATION_TYPE.MESSAGE, 'meta.messageId': message._id });
  await refreshConversationPreview(conversation._id, actorId);
  await logActivity({ actorId, action: ACTIVITY_ACTION.DELETE, targetType: 'Message', targetId: message._id, description: 'Deleted a direct message for everyone', ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.id });
  return sendResponse(res, 200, 'Message deleted for everyone.', { messageId: message._id, conversationId: conversation._id, mode, deleted: true });
});

export const markConversationRead = asyncHandler(async (req, res) => {
  const actorId = idString(req.user._id);
  const conversation = await loadConversationForMember(req.params.conversationId, actorId);
  const readAt = new Date();
  const result = await Message.updateMany(
    { conversation: conversation._id, recipient: actorId, readAt: null, hiddenFor: { $ne: actorId } },
    { $set: { readAt } },
  );
  await Notification.updateMany(
    { user: actorId, type: NOTIFICATION_TYPE.MESSAGE, 'meta.conversationId': conversation._id, isRead: false },
    { $set: { isRead: true } },
  );
  return sendResponse(res, 200, 'Conversation marked as read.', { updated: result.modifiedCount || 0 });
});
