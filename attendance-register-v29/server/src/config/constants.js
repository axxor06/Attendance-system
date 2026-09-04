// Centralized application constants.
// Importing from here instead of hardcoding strings avoids typos and
// makes refactors (e.g. renaming a role) a one-line change.

export const ROLES = Object.freeze({
  // Canonical stored roles required by the college product model.
  SUPER_ADMIN: 'super_admin', // HOD / highest-privilege college operator
  ADMIN: 'admin', // Faculty / teaching staff
  USER: 'user', // Student / learner
  // Friendly code aliases retained so existing controller intent stays explicit.
  HOD: 'super_admin',
  FACULTY: 'admin',
  STUDENT: 'user',
});

export const ROLE_LIST = Object.freeze([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER]);

export const LEGACY_ROLE_MAP = Object.freeze({
  hod: ROLES.SUPER_ADMIN,
  faculty: ROLES.ADMIN,
  student: ROLES.USER,
});

export const ALL_ACCEPTED_ROLE_LIST = Object.freeze([
  ...new Set([...ROLE_LIST, ...Object.keys(LEGACY_ROLE_MAP)]),
]);

export const REGISTRATION_REQUEST_ROLE_LIST = Object.freeze([
  ROLES.USER,
  ROLES.ADMIN,
  'student',
  'faculty',
]);

export function canonicalRole(role) {
  return LEGACY_ROLE_MAP[role] || role;
}

export function roleValues(role) {
  const canonical = canonicalRole(role);
  return Object.freeze([canonical, ...Object.entries(LEGACY_ROLE_MAP)
    .filter(([, mapped]) => mapped === canonical)
    .map(([legacy]) => legacy)]);
}

export const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
});

export const ATTENDANCE_STATUS_LIST = Object.values(ATTENDANCE_STATUS);

// Statuses that count as "attended" for percentage calculations.
export const PRESENT_LIKE_STATUSES = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.LATE,
];

export const OTP_PURPOSE = Object.freeze({
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  EMAIL_CHANGE: 'email_change',
});

export const NOTIFICATION_TYPE = Object.freeze({
  ATTENDANCE_MARKED: 'attendance_marked',
  OTP_SENT: 'otp_sent',
  PASSWORD_CHANGED: 'password_changed',
  LOW_ATTENDANCE: 'low_attendance',
  ACCOUNT_CREATED: 'account_created',
  GENERAL: 'general',
  LEAVE_REQUEST: 'leave_request',
  ASSIGNMENT_REQUEST: 'assignment_request',
  MESSAGE: 'message',
});

export const ACTIVITY_ACTION = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  FAILED_LOGIN: 'failed_login',
  GENERATE_QR: 'generate_qr',
  SCAN_QR: 'scan_qr',
  GENERATE_REPORT: 'generate_report',
  MARK_ATTENDANCE: 'mark_attendance',
  EDIT_ATTENDANCE: 'edit_attendance',
  PASSWORD_RESET: 'password_reset',
  DEVICE_BINDING_RESET: 'device_binding_reset',
  DEACTIVATE: 'deactivate',
  LEAVE_REQUEST: 'leave_request',
  LEAVE_DECISION: 'leave_decision',
  TIMETABLE_UPDATE: 'timetable_update',
  TUTOR_ASSIGNMENT: 'tutor_assignment',
  ASSIGNMENT_REQUEST: 'assignment_request',
  ASSIGNMENT_DECISION: 'assignment_decision',
  MESSAGE_SENT: 'message_sent',
});

export const LEAVE_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const LEAVE_STATUS_LIST = Object.values(LEAVE_STATUS);

export const ASSIGNMENT_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

export const ASSIGNMENT_REQUEST_STATUS_LIST = Object.values(ASSIGNMENT_REQUEST_STATUS);

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const LOW_ATTENDANCE_THRESHOLD = 75; // percentage

export const COOKIE_NAME = 'refreshToken';

export const PERIOD_KIND = Object.freeze({
  CLASS: 'class', // a normal teachable period attendance can be taken for
  BREAK: 'break', // assembly / lunch / free slot - not used for attendance
});
