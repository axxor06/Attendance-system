import { Notification } from '../models/index.js';

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
