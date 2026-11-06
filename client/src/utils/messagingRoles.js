export function normalizeRole(role) {
  if (role === 'super_admin' || role === 'superadmin' || role === 'hod') return 'super_admin';
  if (role === 'admin' || role === 'faculty') return 'admin';
  return 'user';
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'super_admin') return 'HOD';
  if (normalized === 'admin') return 'Faculty';
  return 'Student';
}

/** Recipient categories offered in New message, by the current user's role. */
export const GROUPS_BY_ROLE = {
  super_admin: [
    { key: 'students', label: 'Students' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'tutors', label: 'Tutors' },
  ],
  admin: [
    { key: 'students', label: 'Students' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'tutors', label: 'Tutors' },
    { key: 'hod', label: 'HOD' },
  ],
  user: [
    { key: 'students', label: 'Classmates' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'tutors', label: 'Tutors' },
    { key: 'hod', label: 'HOD' },
  ],
};

export function displayName(account) {
  return account?.name || account?.email || 'Account';
}

export function initials(account) {
  return displayName(account).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A';
}
