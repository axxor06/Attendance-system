import asyncHandler from 'express-async-handler';
import { Notification } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { getBadgeCounts } from '../services/badgeService.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { NOTIFICATION_TYPE } from '../config/constants.js';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const { unreadOnly, type } = req.query;
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

  const filter = { user: req.user._id };
  if (unreadOnly === 'true') filter.isRead = false;
  if (type !== undefined) {
    if (!Object.values(NOTIFICATION_TYPE).includes(type)) throw ApiError.badRequest('Unsupported notification type.');
    filter.type = type;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  return sendResponse(res, 200, 'Notifications fetched', {
    notifications,
    unreadCount,
    pagination: paginationMeta({ total, page, limit }),
  });
});

/** Lightweight, database-backed counts for the sidebar badges. */
export const getNotificationSummary = asyncHandler(async (req, res) => {
  const counts = await getBadgeCounts(req.user);
  return sendResponse(res, 200, 'Notification summary fetched', counts);
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) throw ApiError.notFound('Notification not found');

  notification.isRead = true;
  await notification.save();

  return sendResponse(res, 200, 'Notification marked as read', { notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  return sendResponse(res, 200, 'All notifications marked as read');
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!notification) throw ApiError.notFound('Notification not found');
  return sendResponse(res, 200, 'Notification deleted');
});
