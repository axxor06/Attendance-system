import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { canonicalRole } from '../../components/layout/navigation.js';
import CorrectionWorkspace from '../../components/attendance/CorrectionWorkspace.jsx';
import CorrectionLog from '../../components/attendance/CorrectionLog.jsx';
import { fadeUp } from '../../utils/motion.js';

/**
 * Faculty: "Attendance history" - correct a past session, and see your correction history.
 * HOD: "Attendance corrections" - review the institution-wide audit trail, or correct a session.
 */
export default function AttendanceCorrectionsPage() {
  const { user } = useAuth();
  const isHod = canonicalRole(user?.role) === 'super_admin';
  const tabs = isHod
    ? [{ id: 'log', label: 'Correction log' }, { id: 'correct', label: 'Correct a session' }]
    : [{ id: 'correct', label: 'Correct a session' }, { id: 'log', label: 'Correction history' }];
  const [tab, setTab] = useState(tabs[0].id);

  return (
    <motion.div className="flex flex-col gap-5" {...fadeUp}>
      <header className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-semibold text-ink">{isHod ? 'Attendance corrections' : 'Attendance history'}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate">
          {isHod ? 'Every change to saved attendance is recorded with who made it, when, and why.' : 'Open a past session, fix a student\'s status and save. The student\'s attendance updates immediately and the change is recorded.'}
        </p>
      </header>
      <div className="flex gap-1 border-b border-line" role="tablist">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={clsx('border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors', tab === item.id ? 'border-ink text-ink' : 'border-transparent text-slate hover:text-ink')}>{item.label}</button>
        ))}
      </div>
      {tab === 'correct' ? <CorrectionWorkspace /> : <CorrectionLog />}
    </motion.div>
  );
}
