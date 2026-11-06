import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, CalendarCheck2, CheckCircle2, ClipboardCheck, Clock, History, QrCode, RefreshCw, UsersRound } from 'lucide-react';
import { format } from 'date-fns';
import { dashboardApi } from '../../api/misc.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { attendanceApi } from '../../api/attendance.js';
import Card from '../../components/common/Card.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import { fadeUp } from '../../utils/motion.js';

function StatLine({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent"><Icon size={19} /></span>
      <div className="min-w-0">
        <p className="font-display text-2xl font-semibold leading-none text-ink">{value}</p>
        <p className="mt-1.5 text-xs font-medium text-slate">{label}</p>
      </div>
    </div>
  );
}

function WorkspaceLink({ to, label, detail, icon: Icon }) {
  return (
    <Link to={to} className="group flex items-center gap-3 border-b border-line py-3.5 last:border-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-paper-dim text-ink-light transition-colors group-hover:bg-accent-light group-hover:text-accent"><Icon size={16} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{label}</span><span className="mt-0.5 block text-xs text-slate">{detail}</span></span>
      <ArrowRight size={15} className="shrink-0 text-slate/60 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
    </Link>
  );
}

export default function FacultyDashboardPage() {
  const { user } = useAuth();
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
    if (dashboardResult.status === 'rejected' || pendingResult.status === 'rejected') setLoadError('Some teaching data could not be loaded.');
    setIsLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Loading Faculty dashboard">
        {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}
      </div>
    );
  }

  const { assignedSubjectsCount = 0, subjects = [], todayMarkedCount = 0, recentAttendance = [], todaySchedule = [], recentCorrections = [], correctionsLastWeek = 0 } = data || {};

  return (
    <motion.div className="space-y-6" {...fadeUp}>
      <header className="flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Teaching desk</h1>
          <p className="page-lede mt-2">Good to see you, {user?.name?.split(' ')?.[0] || 'there'}. Work from your assigned subjects and classes.</p>
        </div>
        <span className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-slate"><CalendarCheck2 size={15} aria-hidden="true" /> {format(new Date(), 'EEEE, d MMM')}</span>
      </header>

      {loadError && (
        <div className="notice-caution" role="alert">
          <p className="text-sm">{loadError}</p>
          <Button type="button" variant="outline" icon={RefreshCw} size="sm" onClick={loadDashboard}>Retry</Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatLine label="My subjects" value={assignedSubjectsCount} icon={BookOpen} />
        <StatLine label="Marked today" value={todayMarkedCount} icon={CalendarCheck2} />
        <StatLine label="Pending sessions" value={pending.length} icon={ClipboardCheck} />
        <StatLine label="Corrections, last 7 days" value={correctionsLastWeek} icon={History} />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <h2 className="font-display text-xl font-semibold text-ink">Today's timetable</h2>
          <Link to="/faculty/attendance-history" className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:text-accent">Attendance history <ArrowRight size={12} aria-hidden="true" /></Link>
        </div>
        {todaySchedule.length === 0 ? (
          <div className="py-7"><EmptyState icon={CalendarCheck2} title="No classes scheduled today" message="Periods assigned to you in the class timetables will appear here." /></div>
        ) : (
          <ul className="divide-y divide-line">
            {todaySchedule.map((period) => (
              <li key={`${period.subjectId}-${period.periodOrder}`} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-paper-dim text-slate" aria-hidden="true">{period.attendanceTaken ? <CheckCircle2 size={16} className="text-sage" /> : <Clock size={15} />}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{period.subjectName}</p>
                    <p className="truncate text-xs text-slate">{period.className} · {period.periodName}{period.startTime ? ` · ${period.startTime}${period.endTime ? `–${period.endTime}` : ''}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-12 sm:pl-0">
                  <Badge variant={period.attendanceTaken ? 'present' : 'late'}>{period.attendanceTaken ? 'Attendance taken' : 'Not taken'}</Badge>
                  {!period.attendanceTaken && <Link to={`/faculty/take-attendance?subjectId=${period.subjectId}&periodOrder=${period.periodOrder}`}><Button size="sm" variant="amber">Take attendance</Button></Link>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <h2 className="font-display text-xl font-semibold text-ink">Sessions waiting for attendance</h2>
            <Badge variant={pending.length ? 'late' : 'present'}>{pending.length}</Badge>
          </div>
          {pending.length === 0 ? (
            <div className="py-7"><EmptyState icon={ClipboardCheck} title="Nothing pending" message="All attendance sessions currently returned by the server are up to date." /></div>
          ) : (
            <div className="divide-y divide-line">
              {pending.map((item) => (
                <div key={`${item.subjectId}-${item.periodOrder}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-semibold text-ink">{item.subjectName}</p><p className="mt-1 text-xs text-slate">{item.className} · {item.periodName}</p></div>
                  <Link to={`/faculty/take-attendance?subjectId=${item.subjectId}&periodOrder=${item.periodOrder}`}><Button size="sm" variant="amber">Mark now</Button></Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-xl font-semibold text-ink">Teaching tools</h2>
          <div className="mt-3">
            <WorkspaceLink to="/faculty/take-attendance" label="Mark attendance" detail="Open an assigned roster" icon={ClipboardCheck} />
            <WorkspaceLink to="/faculty/attendance-history" label="Correct past attendance" detail="Fix a status after the class" icon={History} />
            <WorkspaceLink to="/faculty/qr-attendance" label="Start QR session" detail="Use a scoped session" icon={QrCode} />
            <WorkspaceLink to="/faculty/students" label="Assigned students" detail="Read your authorized roster" icon={UsersRound} />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-end justify-between border-b border-line pb-4">
            <h2 className="font-display text-xl font-semibold text-ink">My subjects</h2>
            <Link to="/faculty/subjects" className="text-xs font-semibold text-ink hover:text-accent">Open all →</Link>
          </div>
          {subjects.length === 0 ? (
            <div className="py-7"><EmptyState icon={BookOpen} title="No subjects assigned" message="Your HOD will assign subjects to you." /></div>
          ) : (
            <div className="divide-y divide-line">
              {subjects.slice(0, 8).map((subject) => (
                <div key={subject._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{subject.name}</p><p className="mt-1 truncate font-mono text-xs text-slate">{subject.code} · {subject.class?.name || 'Class not set'}</p></div>
                  <Link to={`/faculty/take-attendance?subjectId=${subject._id}`} className="shrink-0 text-xs font-semibold text-accent">Mark →</Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-end justify-between border-b border-line pb-4"><h2 className="font-display text-xl font-semibold text-ink">Recent corrections</h2><Link to="/faculty/attendance-history" className="text-xs font-semibold text-ink hover:text-accent">View all →</Link></div>
          {recentCorrections.length === 0 ? (
            <div className="py-7"><EmptyState icon={History} title="No corrections yet" message="When you fix a past attendance status it is listed here." /></div>
          ) : (
            <div className="divide-y divide-line">
              {recentCorrections.map((row) => (
                <div key={row._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{row.student?.name || 'Student'}</p><p className="truncate text-xs text-slate">{row.subject?.name || 'Subject'} · {format(new Date(row.date), 'd MMM')}</p></div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs">{row.previousStatus ? <Badge variant={row.previousStatus}>{row.previousStatus}</Badge> : <span className="text-slate">new</span>}<span aria-label="changed to">→</span><Badge variant={row.newStatus}>{row.newStatus}</Badge></span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="border-b border-line pb-4"><h2 className="font-display text-xl font-semibold text-ink">Latest attendance activity</h2></div>
          {recentAttendance.length === 0 ? (
            <div className="py-7"><EmptyState title="No records yet" message="Records appear after you mark attendance." /></div>
          ) : (
            <div className="divide-y divide-line">
              {recentAttendance.slice(0, 8).map((record) => (
                <div key={record._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{record.student?.name || 'Student'}</p><p className="truncate text-xs text-slate">{record.subject?.name || 'Subject'} · {record.periodName || 'Session'}</p></div>
                  <Badge variant={record.status}>{record.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </motion.div>
  );
}
