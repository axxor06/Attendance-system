import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function SearchResultsPanel({ results, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!results) return <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="w-full border border-ink/10 bg-white p-4 text-sm text-slate shadow-xl">Searching…</motion.div>;

  const { students = [], faculty = [], departments = [], subjects = [] } = results;
  const hasAny = students.length || faculty.length || departments.length || subjects.length;
  const destination = (type, title) => {
    const page = type === 'students' || type === 'faculty'
      ? (['hod', 'admin', 'super_admin'].includes(user?.role) ? '/hod/people' : '/faculty/subjects')
      : (['hod', 'admin', 'super_admin'].includes(user?.role) ? '/hod/academics' : '/faculty/subjects');
    navigate(`${page}?search=${encodeURIComponent(title)}`);
    onClose?.();
  };

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="max-h-80 w-full overflow-y-auto border border-ink/10 bg-white shadow-xl" role="listbox" aria-label="Search results">
      {!hasAny && <div className="px-4 py-5 text-center text-sm text-slate">No matches found.</div>}
      {students.length > 0 && <ResultSection title="Students">{students.map((student) => <ResultRow key={student._id} title={student.name} subtitle={[student.registerNumber, student.class?.name].filter(Boolean).join(' · ')} onClick={() => destination('students', student.name)} />)}</ResultSection>}
      {faculty.length > 0 && <ResultSection title="Faculty">{faculty.map((facultyMember) => <ResultRow key={facultyMember._id} title={facultyMember.name} subtitle={[facultyMember.employeeId, facultyMember.department?.name].filter(Boolean).join(' · ')} onClick={() => destination('faculty', facultyMember.name)} />)}</ResultSection>}
      {departments.length > 0 && <ResultSection title="Departments">{departments.map((department) => <ResultRow key={department._id} title={department.name} subtitle={department.code} onClick={() => destination('departments', department.name)} />)}</ResultSection>}
      {subjects.length > 0 && <ResultSection title="Subjects">{subjects.map((subject) => <ResultRow key={subject._id} title={subject.name} subtitle={[subject.code, subject.class?.name].filter(Boolean).join(' · ')} onClick={() => destination('subjects', subject.name)} />)}</ResultSection>}
    </motion.div>
  );
}

function ResultSection({ title, children }) {
  return <div className="border-b border-ink/5 py-1.5 last:border-0"><p className="px-4 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate/60">{title}</p>{children}</div>;
}

function ResultRow({ title, subtitle, onClick }) {
  return <button type="button" role="option" onClick={onClick} className="block w-full px-4 py-2 text-left transition-colors hover:bg-ink/4 focus:bg-ink/5 focus:outline-none"><p className="text-sm font-medium text-ink">{title}</p>{subtitle && <p className="text-xs text-slate">{subtitle}</p>}</button>;
}
