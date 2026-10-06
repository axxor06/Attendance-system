import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { canonicalRole } from './navigation.js';

export default function SearchResultsPanel({ results, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!results) return <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-2xl border border-line bg-surface p-4 text-sm text-slate shadow-[0_18px_42px_rgba(16,47,66,0.16)]">Searching…</motion.div>;

  const { students = [], faculty = [], departments = [], subjects = [] } = results;
  const hasAny = students.length || faculty.length || departments.length || subjects.length;
  const destination = (type, title) => {
    const role = canonicalRole(user?.role);
    const page = type === 'students'
      ? (role === 'super_admin' ? '/hod/students' : '/faculty/students')
      : type === 'faculty'
        ? (role === 'super_admin' ? '/hod/faculty' : '/faculty/subjects')
        : (role === 'super_admin' ? '/hod/academics' : '/faculty/subjects');
    navigate(`${page}?search=${encodeURIComponent(title)}`);
    onClose?.();
  };

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="max-h-80 w-full overflow-y-auto rounded-2xl border border-line bg-surface shadow-[0_18px_42px_rgba(16,47,66,0.16)]" role="listbox" aria-label="Search results">
      {!hasAny && <div className="px-4 py-5 text-center text-sm text-slate">No matches found.</div>}
      {students.length > 0 && <ResultSection title="Students">{students.map((student) => <ResultRow key={student._id} title={student.name} subtitle={[student.registerNumber, student.class?.name].filter(Boolean).join(' · ')} onClick={() => destination('students', student.name)} />)}</ResultSection>}
      {faculty.length > 0 && <ResultSection title="Faculty">{faculty.map((facultyMember) => <ResultRow key={facultyMember._id} title={facultyMember.name} subtitle={[facultyMember.employeeId, facultyMember.department?.name].filter(Boolean).join(' · ')} onClick={() => destination('faculty', facultyMember.name)} />)}</ResultSection>}
      {departments.length > 0 && <ResultSection title="Departments">{departments.map((department) => <ResultRow key={department._id} title={department.name} subtitle={department.code} onClick={() => destination('departments', department.name)} />)}</ResultSection>}
      {subjects.length > 0 && <ResultSection title="Subjects">{subjects.map((subject) => <ResultRow key={subject._id} title={subject.name} subtitle={[subject.code, subject.class?.name].filter(Boolean).join(' · ')} onClick={() => destination('subjects', subject.name)} />)}</ResultSection>}
    </motion.div>
  );
}

function ResultSection({ title, children }) {
  return <div className="border-b border-line/70 py-1.5 last:border-0"><p className="px-4 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate/60">{title}</p>{children}</div>;
}

function ResultRow({ title, subtitle, onClick }) {
  return <button type="button" role="option" onClick={onClick} className="block w-full px-4 py-3 text-left transition-[background-color,transform] duration-160 hover:bg-indigo-light/60 focus:bg-indigo-light/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60"><p className="text-sm font-medium text-ink">{title}</p>{subtitle && <p className="text-xs text-slate">{subtitle}</p>}</button>;
}
