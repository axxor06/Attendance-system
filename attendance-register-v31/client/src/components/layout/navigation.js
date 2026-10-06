import {
  LayoutDashboard,
  GraduationCap,
  Bell,
  ClipboardCheck,
  BookOpen,
  FileBarChart2,
  UsersRound,
  CalendarDays,
  Building2,
  QrCode,
  UserPlus,
  AlertTriangle,
  MessagesSquare,
  BadgeCheck,
} from 'lucide-react';

export const ROLE_ALIASES = Object.freeze({
  hod: 'super_admin',
  faculty: 'admin',
  student: 'user',
});

export function canonicalRole(role) {
  return ROLE_ALIASES[role] || role;
}

export const NAV = {
  super_admin: [
    { label: 'Command centre', items: [{ to: '/hod', label: 'Overview', icon: LayoutDashboard }] },
    { label: 'Institution', items: [
      { to: '/hod/academics', label: 'Academic structure', icon: Building2 },
      { to: '/hod/periods', label: 'Period timetable', icon: CalendarDays },
    ] },
    { label: 'People', items: [
      { to: '/hod/students', label: 'Students', icon: GraduationCap },
      { to: '/hod/faculty', label: 'Faculty', icon: UsersRound },
      { to: '/hod/tutors', label: 'Tutors', icon: BadgeCheck },
    ] },
    { label: 'Operations', items: [
      { to: '/hod/registrations', label: 'Registration requests', icon: UserPlus },
      { to: '/hod/reports', label: 'Attendance reports', icon: FileBarChart2 },
      { to: '/hod/notifications', label: 'Notifications', icon: Bell },
      { to: '/hod/leave-requests', label: 'Leave requests', icon: ClipboardCheck },
      { to: '/hod/assignment-requests', label: 'Assignment review', icon: AlertTriangle },
      { to: '/hod/messages', label: 'Messages', icon: MessagesSquare },
    ] },
  ],
  admin: [
    { label: 'Teaching desk', items: [{ to: '/faculty', label: 'Overview', icon: LayoutDashboard }] },
    { label: 'Today', items: [
      { to: '/faculty/take-attendance', label: 'Take attendance', icon: ClipboardCheck },
      { to: '/faculty/qr-attendance', label: 'QR attendance', icon: QrCode },
    ] },
    { label: 'Teaching', items: [
      { to: '/faculty/subjects', label: 'My subjects', icon: BookOpen },
      { to: '/faculty/students', label: 'Assigned students', icon: UsersRound },
    ] },
    { label: 'Review', items: [
      { to: '/faculty/reports', label: 'Attendance reports', icon: FileBarChart2 },
      { to: '/faculty/notifications', label: 'Notifications', icon: Bell },
      { to: '/faculty/leave-requests', label: 'Tutor leave review', icon: ClipboardCheck },
      { to: '/faculty/assignment-requests', label: 'Cannot take a slot?', icon: AlertTriangle },
      { to: '/faculty/messages', label: 'Messages', icon: MessagesSquare },
    ] },
  ],
  user: [
    { label: 'Your record', items: [{ to: '/student', label: 'Overview', icon: LayoutDashboard }] },
    { label: 'Attendance', items: [
      { to: '/student/attendance', label: 'My attendance', icon: ClipboardCheck },
      { to: '/student/timetable', label: 'My timetable', icon: CalendarDays },
      { to: '/student/scan-qr', label: 'Scan QR', icon: QrCode },
    ] },
    { label: 'Requests', items: [
      { to: '/student/leave-requests', label: 'Leave requests', icon: ClipboardCheck },
      { to: '/student/notifications', label: 'Notifications', icon: Bell },
      { to: '/student/messages', label: 'Messages', icon: MessagesSquare },
    ] },
  ],
};

export const ROLE_LABELS = Object.freeze({
  super_admin: 'Head of Department',
  admin: 'Faculty',
  user: 'Student',
  hod: 'Head of Department',
  faculty: 'Faculty',
  student: 'Student',
});

export const ROLE_SHORT_LABELS = Object.freeze({
  super_admin: 'HOD',
  admin: 'Faculty',
  user: 'Student',
  hod: 'HOD',
  faculty: 'Faculty',
  student: 'Student',
});

export function getNavigationForRole(role) {
  return NAV[canonicalRole(role)] || [];
}

export function getNavigationItems(role) {
  return getNavigationForRole(role).flatMap((section) => section.items);
}

export function getHomePath(role) {
  const normalized = canonicalRole(role);
  if (normalized === 'super_admin') return '/hod';
  if (normalized === 'admin') return '/faculty';
  if (normalized === 'user') return '/student';
  return '/login';
}

export function getProfileBase(role) {
  const normalized = canonicalRole(role);
  return getHomePath(normalized);
}
