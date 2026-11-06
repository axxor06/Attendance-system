import { Message, Notification, RegistrationRequest } from '../models/index.js';
import { ROLES, canonicalRole } from '../config/constants.js';

/**
 * Pending registration requests, broken down by applicant type. Counts come
 * straight from the requests collection (status === 'pending'), so they are
 * independent of notification read state and survive logout/login.
 */
export async function getRegistrationSummary() {
  const rows = await RegistrationRequest.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: '$requestedRole', count: { $sum: 1 } } },
  ]);
  let students = 0;
  let faculty = 0;
  for (const row of rows) {
    if (canonicalRole(row._id) === ROLES.ADMIN || row._id === 'faculty') faculty += row.count;
    else students += row.count;
  }
  return { pending: students + faculty, students, faculty };
}

/**
 * Counts that drive the sidebar badges. Notifications and pending requests are
 * deliberately separate numbers.
 */
export async function getBadgeCounts(user) {
  const role = canonicalRole(user.role);
  const [unreadNotifications, unreadMessages, registrations] = await Promise.all([
    Notification.countDocuments({ user: user._id, isRead: false }),
    Message.countDocuments({ recipient: user._id, readAt: null, hiddenFor: { $ne: user._id } }),
    role === ROLES.SUPER_ADMIN ? getRegistrationSummary() : Promise.resolve(null),
  ]);
  return {
    unreadNotifications,
    unreadMessages,
    pendingRegistrations: registrations ? registrations.pending : null,
    registrations,
  };
}
