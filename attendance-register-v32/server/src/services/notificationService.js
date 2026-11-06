import { Notification, User } from '../models/index.js';
import { NOTIFICATION_TYPE, ROLES, roleValues } from '../config/constants.js';

/**
 * Creates a notification document for a single user.
 * Centralized here so every part of the app (auth, attendance, etc.)
 * creates notifications the same way.
 */
export async function notifyUser({ userId, type, title, message, meta = {} }) {
  return Notification.create({ user: userId, type, title, message, meta });
}

/**
 * Creates the same notification for many users at once (e.g. a whole class).
 */
export async function notifyMany({ userIds, type, title, message, meta = {} }) {
  if (!userIds || userIds.length === 0) return [];
  const docs = userIds.map((userId) => ({ user: userId, type, title, message, meta }));
  return Notification.insertMany(docs);
}

/**
 * Idempotent notification: at most one document per (user, dedupeKey).
 * Safe to call repeatedly or concurrently for the same event. Returns the
 * number of documents actually created.
 */
export async function notifyUsersOnce({ userIds, dedupeKey, type, title, message, meta = {} }) {
  const unique = [...new Set((userIds || []).map(String))];
  if (!unique.length) return 0;
  const result = await Notification.bulkWrite(
    unique.map((userId) => ({
      updateOne: {
        filter: { user: userId, dedupeKey },
        update: { $setOnInsert: { user: userId, dedupeKey, type, title, message, meta, isRead: false } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return result.upsertedCount || 0;
}

export function registrationNotificationKey(requestId) {
  return `registration-request:${String(requestId)}`;
}

/**
 * Tells every active HOD that a registration request is waiting. HOD is the
 * institution-wide approval tier in this product, so every active HOD receives
 * exactly one persistent notification per request.
 */
export async function notifyRegistrationSubmitted(request) {
  const hods = await User.find({ role: { $in: roleValues(ROLES.SUPER_ADMIN) }, isActive: true }).select('_id').lean();
  const isFaculty = [ROLES.ADMIN, 'faculty'].includes(request.requestedRole);
  return notifyUsersOnce({
    userIds: hods.map((hod) => hod._id),
    dedupeKey: registrationNotificationKey(request._id),
    type: NOTIFICATION_TYPE.REGISTRATION_REQUEST,
    title: isFaculty ? 'New faculty registration request' : 'New student registration request',
    message: `${request.name} has requested ${isFaculty ? 'faculty' : 'student'} access and is waiting for review.`,
    meta: { requestId: request._id, requestedRole: isFaculty ? 'faculty' : 'student', link: '/hod/registrations' },
  });
}

/**
 * Once a request is approved or rejected its notification is no longer
 * actionable, so it is marked read for every HOD. This changes only the
 * notification badge: the pending-request count is computed from the requests
 * themselves and is never affected by notification read state.
 */
export async function resolveRegistrationNotifications(requestId, status) {
  return Notification.updateMany(
    { dedupeKey: registrationNotificationKey(requestId) },
    { $set: { isRead: true, 'meta.resolvedStatus': status } },
  );
}
