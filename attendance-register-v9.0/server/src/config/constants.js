// Centralized application constants.
// Importing from here instead of hardcoding strings avoids typos and
// makes refactors (e.g. renaming a role) a one-line change.

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HOD: 'hod',
  FACULTY: 'faculty',
  STUDENT: 'student',
});

export const ROLE_LIST = Object.values(ROLES);

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
});

export const NOTIFICATION_TYPE = Object.freeze({
  ATTENDANCE_MARKED: 'attendance_marked',
  OTP_SENT: 'otp_sent',
  PASSWORD_CHANGED: 'password_changed',
  LOW_ATTENDANCE: 'low_attendance',
  ACCOUNT_CREATED: 'account_created',
  GENERAL: 'general',
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
  DEACTIVATE: 'deactivate',
});

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
