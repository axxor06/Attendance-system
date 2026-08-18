import {
  LayoutDashboard, GraduationCap, Bell, ClipboardCheck, BookOpen, FileBarChart,
  Users, CalendarClock, UserCheck, LayoutGrid, QrCode,
} from 'lucide-react';

export const NAV = {
  super_admin: [
    { label: 'Overview', items: [{ to: '/hod', label: 'Dashboard', icon: LayoutDashboard }] },
    { label: 'Academics', items: [
      { to: '/hod/academics', label: 'Academic management', icon: LayoutGrid },
      { to: '/hod/people', label: 'Faculty & students', icon: Users },
      { to: '/hod/periods', label: 'Period timetable', icon: CalendarClock },
    ] },
    { label: 'Operations', items: [
      { to: '/hod/registrations', label: 'Registrations', icon: UserCheck },
      { to: '/hod/reports', label: 'Reports', icon: FileBarChart },
    ] },
  ],
  admin: [
    { label: 'Overview', items: [{ to: '/hod', label: 'Dashboard', icon: LayoutDashboard }] },
    { label: 'Academics', items: [
      { to: '/hod/academics', label: 'Academic management', icon: LayoutGrid },
      { to: '/hod/people', label: 'Faculty & students', icon: Users },
      { to: '/hod/periods', label: 'Period timetable', icon: CalendarClock },
    ] },
    { label: 'Operations', items: [
      { to: '/hod/registrations', label: 'Registrations', icon: UserCheck },
      { to: '/hod/reports', label: 'Reports', icon: FileBarChart },
    ] },
  ],
  hod: [
    { label: 'Overview', items: [{ to: '/hod', label: 'Dashboard', icon: LayoutDashboard }] },
    { label: 'Academics', items: [
      { to: '/hod/academics', label: 'Academic management', icon: LayoutGrid },
      { to: '/hod/people', label: 'Faculty & students', icon: Users },
      { to: '/hod/periods', label: 'Period timetable', icon: CalendarClock },
    ] },
    { label: 'Operations', items: [
      { to: '/hod/registrations', label: 'Registrations', icon: UserCheck },
      { to: '/hod/reports', label: 'Reports', icon: FileBarChart },
    ] },
  ],
  faculty: [
    { label: 'Overview', items: [{ to: '/faculty', label: 'Dashboard', icon: LayoutDashboard }] },
    { label: 'Attendance', items: [
      { to: '/faculty/take-attendance', label: 'Take attendance', icon: ClipboardCheck },
      { to: '/faculty/qr-attendance', label: 'QR attendance', icon: QrCode },
    ] },
    { label: 'Academics', items: [
      { to: '/faculty/subjects', label: 'My subjects', icon: BookOpen },
      { to: '/faculty/reports', label: 'Reports', icon: FileBarChart },
    ] },
  ],
  student: [
    { label: 'Overview', items: [{ to: '/student', label: 'Dashboard', icon: LayoutDashboard }] },
    { label: 'My learning', items: [
      { to: '/student/attendance', label: 'My attendance', icon: GraduationCap },
      { to: '/student/timetable', label: 'Timetable', icon: CalendarClock },
      { to: '/student/notifications', label: 'Notifications', icon: Bell },
    ] },
  ],
};

export const ROLE_LABELS = {
  super_admin: 'System administrator',
  admin: 'Administrator',
  hod: 'Head of department',
  faculty: 'Faculty',
  student: 'Student',
};

export function getNavigationForRole(role) {
  return NAV[role] || [];
}

export function getNavigationItems(role) {
  return getNavigationForRole(role).flatMap((section) => section.items);
}
