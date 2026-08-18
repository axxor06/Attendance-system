import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, ClipboardCheck, CalendarCheck, QrCode, ChevronRight } from 'lucide-react';
import { dashboardApi } from '../../api/misc.js';
import { attendanceApi } from '../../api/attendance.js';
import StatCard from '../../components/dashboard/StatCard.jsx';
import QuickActionGrid from '../../components/dashboard/QuickActionGrid.jsx';
import Card from '../../components/common/Card.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import { staggerContainer, staggerItem, fadeUp } from '../../utils/motion.js';

export default function FacultyDashboardPage() {
  const [data, setData] = useState(null);
  const [pending, setPending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const [dashboardResult, pendingResult] = await Promise.allSettled([dashboardApi.faculty(), attendanceApi.pending()]);
    if (dashboardResult.status === 'fulfilled') setData(dashboardResult.value.data?.data || {});
    if (pendingResult.status === 'fulfilled') setPending(pendingResult.value.data?.data?.pending || []);
    if (dashboardResult.status === 'rejected' || pendingResult.status === 'rejected') {
      setLoadError('Some dashboard data could not be loaded. Retry when the connection is ready.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const { assignedSubjectsCount = 0, subjects = [], todayMarkedCount = 0, recentAttendance = [] } = data || {};

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-slate">Today's attendance</p>
      </div>

      {loadError && (
        <Card className="border-clay/20 bg-clay-light/60 px-5 py-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-clay">Dashboard data needs attention</p><p className="mt-1 text-sm text-clay/80">{loadError}</p></div>
            <Button type="button" variant="outline" onClick={loadDashboard}>Retry</Button>
          </div>
        </Card>
      )}

      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        variants={staggerContainer} initial="initial" animate="animate"
      >
        <StatCard label="Assigned Subjects" value={assignedSubjectsCount} icon={BookOpen} accent="indigo" />
        <StatCard label="Marked Today" value={todayMarkedCount} icon={CalendarCheck} accent="sage" />
        <StatCard label="Pending Today" value={pending.length} icon={ClipboardCheck}
          accent={pending.length > 0 ? 'amber' : 'sage'} />
      </motion.div>

      <QuickActionGrid actions={[
        { to: '/faculty/take-attendance', label: 'Mark attendance', description: 'Open today’s roster', icon: ClipboardCheck, tone: 'indigo' },
        { to: '/faculty/qr-attendance', label: 'Start QR session', description: 'Let students scan in', icon: QrCode, tone: 'sage' },
        { to: '/faculty/subjects', label: 'Review subjects', description: 'Check assigned classes', icon: BookOpen, tone: 'amber' },
        { to: '/faculty/reports', label: 'View reports', description: 'Inspect attendance data', icon: CalendarCheck, tone: 'ink' },
      ]} />

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to="/faculty/take-attendance">
          <motion.div
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 rounded-2xl bg-ink p-5 text-paper shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <p className="font-semibold">Take Attendance</p>
              <p className="text-xs text-paper/70">Mark attendance manually</p>
            </div>
            <ChevronRight size={18} className="ml-auto text-paper/50" />
          </motion.div>
        </Link>
        <Link to="/faculty/qr-attendance">
          <motion.div
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 rounded-2xl border-2 border-ink/10 bg-white p-5 shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink/8 text-ink">
              <QrCode size={22} />
            </div>
            <div>
              <p className="font-semibold text-ink">QR Attendance</p>
              <p className="text-xs text-slate">Generate QR for live scanning</p>
            </div>
            <ChevronRight size={18} className="ml-auto text-slate/40" />
          </motion.div>
        </Link>
      </div>

      {/* Pending sessions */}
      {pending.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Pending for today</h2>
            <Badge variant="amber">{pending.length}</Badge>
          </div>
          <motion.div className="flex flex-col gap-2" variants={staggerContainer} initial="initial" animate="animate">
            {pending.map((p, i) => (
              <motion.div key={i} variants={staggerItem}
                className="flex items-center justify-between rounded-xl border border-amber/20 bg-amber-light/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{p.subjectName}</p>
                  <p className="text-xs text-slate">{p.className} · {p.periodName}</p>
                </div>
                <Link to={`/faculty/take-attendance?subjectId=${p.subjectId}&periodOrder=${p.periodOrder}`}>
                  <Button size="sm" variant="amber">Mark now</Button>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-semibold text-ink">My subjects</h2>
          {subjects.length === 0
            ? <EmptyState icon={BookOpen} title="No subjects assigned" message="Your HOD will assign subjects to you." />
            : (
              <div className="flex flex-col gap-2">
                {subjects.map(s => (
                  <motion.div key={s._id} whileHover={{ x: 4 }}
                    className="flex items-center justify-between rounded-xl border border-ink/8 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{s.name}</p>
                      <p className="font-mono text-xs text-slate">{s.code} · {s.class?.name}</p>
                    </div>
                    <Link to={`/faculty/take-attendance?subjectId=${s._id}`}>
                      <Button size="sm" variant="ghost">Mark →</Button>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )
          }
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Recent attendance</h2>
          {recentAttendance.length === 0
            ? <EmptyState title="No records yet" message="Records appear after you mark attendance." />
            : (
              <div className="divide-y divide-ink/5">
                {recentAttendance.map((r, i) => (
                  <motion.div key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/8 text-[11px] font-semibold text-ink">
                        {r.student?.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{r.student?.name}</p>
                        <p className="truncate text-xs text-slate">{r.subject?.name} · {r.periodName}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={r.status}>{r.status}</Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          }
        </Card>
      </div>
    </motion.div>
  );
}
