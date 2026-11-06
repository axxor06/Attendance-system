import { roleLabel, displayName } from '../../utils/messagingRoles.js';
import Avatar from './Avatar.jsx';

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function Section({ title, children }) {
  return <section className="rounded-md border border-line p-4"><h3 className="text-sm font-semibold text-ink">{title}</h3><div className="mt-2 text-sm text-ink-light">{children}</div></section>;
}

export default function MessageProfile({ profile }) {
  const role = roleLabel(profile.role);
  const details = [
    ['Email', profile.email],
    ['Phone', profile.phone],
    [role === 'Student' ? 'Register number' : 'Employee ID', role === 'Student' ? profile.registerNumber : profile.employeeId],
    ['Department', profile.department?.name],
    ['Class', profile.class?.name],
    ['Semester', profile.class?.semester?.label || (profile.class?.semester?.number ? `Semester ${profile.class.semester.number}` : null)],
    ['Designation', profile.designation],
    ['Qualification', profile.qualification],
    ['Admission year', profile.admissionYear],
    ['Last active', formatDate(profile.lastLoginAt)],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const subjects = (profile.assignedSubjects || []).map((subject) => `${subject.name}${subject.code ? ` (${subject.code})` : ''}${subject.class?.name ? ` · ${subject.class.name}` : ''}`);
  const classes = (profile.assignedClasses || []).map((classDoc) => `${classDoc.name}${classDoc.code ? ` (${classDoc.code})` : ''}`);
  const tutorClasses = (profile.tutorClasses || []).map((classDoc) => `${classDoc.name}${classDoc.code ? ` (${classDoc.code})` : ''}`);
  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex items-center gap-4 border-b border-line pb-4">
        <Avatar account={profile} size="lg" />
        <div className="min-w-0"><h2 className="truncate font-display text-xl font-semibold text-ink">{displayName(profile)}</h2><p className="text-sm text-slate">{role}</p></div>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium text-slate">{label}</dt><dd className="break-words text-sm text-ink">{String(value)}</dd></div>)}
      </dl>
      {subjects.length > 0 && <Section title="Assigned subjects"><ul className="space-y-1">{subjects.map((value) => <li key={value}>{value}</li>)}</ul></Section>}
      {classes.length > 0 && <Section title="Assigned classes"><ul className="space-y-1">{classes.map((value) => <li key={value}>{value}</li>)}</ul></Section>}
      {tutorClasses.length > 0 && <Section title="Tutor of"><ul className="space-y-1">{tutorClasses.map((value) => <li key={value}>{value}</li>)}</ul></Section>}
      {profile.attendance?.overall && (
        <Section title="Attendance"><p><span className="font-mono text-xl font-semibold text-ink">{profile.attendance.overall.percentage ?? 0}%</span> · {profile.attendance.overall.present ?? 0} of {profile.attendance.overall.total ?? 0} sessions attended</p></Section>
      )}
    </div>
  );
}
