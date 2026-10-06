import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Award, CalendarDays, CheckCircle2, Clock, Coffee, QrCode, RefreshCw, Target, TrendingUp, XCircle } from 'lucide-react';
import { dashboardApi } from '../../api/misc.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import SubjectAttendanceChart from '../../components/charts/SubjectAttendanceChart.jsx';
import MonthlyAttendanceChart from '../../components/charts/MonthlyAttendanceChart.jsx';
import { fadeUp } from '../../utils/motion.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { formatCalendarDate } from '../../utils/calendarDate.js';

const DAY_LABEL = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' };

function AttendanceRing({ percentage = 0 }) {
  const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const color = safePercentage < 75 ? 'var(--color-clay)' : safePercentage < 85 ? 'var(--color-amber)' : 'var(--color-sage)';
  return (
    <div className="relative flex items-center justify-center">
      <svg width="152" height="152" className="-rotate-90" aria-label={`${safePercentage}% attendance`} role="img">
        <circle cx="76" cy="76" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="10" />
        <motion.circle
          cx="76" cy="76" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - ((safePercentage / 100) * circumference) }}
          transition={{ duration: 0.8 }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink">{safePercentage}%</p>
        <p className="text-[11px] text-slate">attendance</p>
      </div>
    </div>
  );
}

function TimetableRows({ timetable, todayDay, todayAttendance }) {
  if (!timetable?.length) return <EmptyState icon={CalendarDays} title={`No timetable for ${DAY_LABEL[todayDay] || 'today'}`} message="Your HOD has not configured periods for this day yet." />;
  const attendanceByPeriod = Object.fromEntries((todayAttendance || []).map((record) => [record.periodOrder, record]));
  return (
    <div className="divide-y divide-line">
      {timetable.map((period) => {
        const record = attendanceByPeriod[period.order];
        const isBreak = period.kind === 'break';
        return (
          <div key={period.order} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-paper-dim text-slate">
              {isBreak ? <Coffee size={15} /> : record ? (record.status === 'present' || record.status === 'late' ? <CheckCircle2 size={16} className="text-sage" /> : <XCircle size={16} className="text-clay" />) : <Clock size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${isBreak ? 'text-slate' : 'text-ink'}`}>{period.name}</p>
              {(period.startTime || period.endTime) && <p className="text-xs text-slate">{period.startTime}{period.startTime && period.endTime ? ' – ' : ''}{period.endTime}</p>}
            </div>
            {record ? <Badge variant={record.status}>{record.status}</Badge> : !isBreak && <span className="text-xs text-slate">Upcoming</span>}
          </div>
        );
      })}
    </div>
  );
}

function Prediction({ prediction }) {
  if (!prediction) return null;
  if (prediction.needed75 > 0) {
    return (
      <div className="notice-error">
        <AlertTriangle size={17} />
        <p className="text-sm">Attend <strong>{prediction.needed75}</strong> more consecutive class{prediction.needed75 === 1 ? '' : 'es'} to reach 75%.</p>
      </div>
    );
  }
  return (
    <div className="notice-success">
      <Award size={17} />
      <p className="text-sm"><strong>On track.</strong>{prediction.canMiss75 > 0 ? ` You can miss up to ${prediction.canMiss75} class${prediction.canMiss75 === 1 ? '' : 'es'} and stay above 75%.` : ' Keep attending your upcoming classes.'}</p>
    </div>
  );
}

const QUICK_ACTIONS = [
  { to: '/student/attendance', icon: TrendingUp, title: 'Review attendance', subtitle: 'See subject history' },
  { to: '/student/timetable', icon: CalendarDays, title: 'Open timetable', subtitle: "View today's periods" },
  { to: '/student/notifications', icon: Target, title: 'Notifications', subtitle: 'Read your updates' },
];

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data: response } = await dashboardApi.student();
      setData(response.data);
    } catch (err) {
      setLoadError(getFriendlyError(err, 'Could not load your attendance dashboard.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading Student dashboard">
        {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="notice-error" role="alert">
        <AlertTriangle size={18} />
        <div className="flex-1">
          <p className="font-semibold">Unable to load your overview</p>
          <p className="mt-1 text-sm">{loadError || 'No dashboard data is available yet.'}</p>
          <Button type="button" variant="outline" icon={RefreshCw} className="mt-4" onClick={loadDashboard}>Try again</Button>
        </div>
      </div>
    );
  }

  const { overall = {}, subjectWise = [], monthly = [], recentHistory = [], todayAttendance = [], timetable = [], prediction, lowAttendanceWarning, studentClass, todayDay } = data;
  const todayPresent = todayAttendance.filter((record) => record.status === 'present' || record.status === 'late').length;

  return (
    <motion.div className="space-y-6" {...fadeUp}>
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-accent">Student workspace</p>
          <h1 className="page-title mt-2">Welcome, {user?.name?.split(' ')?.[0] || 'there'}</h1>
          {studentClass && <p className="page-lede mt-2">Current class: {studentClass}.</p>}
        </div>
        <Link to="/student/scan-qr" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-nav sm:w-auto">
          <QrCode size={17} /> Scan attendance QR
        </Link>
      </header>

      {lowAttendanceWarning && (
        <div className="notice-error">
          <AlertTriangle size={18} />
          <p className="text-sm font-medium">Your recorded attendance is below 75%. Attend upcoming classes to avoid academic issues.</p>
        </div>
      )}

      {/* Unified hero panel: ring, breakdown, and today's numbers read as one
          connected story instead of two separate side-by-side cards. */}
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[auto_1px_1fr]">
          <div className="flex flex-col items-center justify-center gap-5 p-6 sm:flex-row sm:gap-8 lg:flex-col lg:gap-5">
            <AttendanceRing percentage={overall.percentage} />
            <div className="grid grid-cols-3 gap-4 text-center sm:gap-6 lg:w-full lg:border-t lg:border-line lg:pt-4">
              <div><p className="font-display text-xl font-semibold text-ink">{overall.total || 0}</p><p className="text-xs text-slate">Total</p></div>
              <div><p className="font-display text-xl font-semibold text-sage">{overall.present || 0}</p><p className="text-xs text-slate">Present</p></div>
              <div><p className="font-display text-xl font-semibold text-clay">{Math.max(0, (overall.total || 0) - (overall.present || 0))}</p><p className="text-xs text-slate">Absent</p></div>
            </div>
          </div>

          <div className="hidden bg-line lg:block" />
          <div className="border-t border-line p-6 lg:border-t-0">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Today's snapshot</p>
              <CalendarDays size={16} className="text-slate" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-line bg-paper p-4"><p className="eyebrow">Present</p><p className="mt-2 font-display text-2xl font-semibold text-sage">{todayPresent}</p></div>
              <div className="rounded-md border border-line bg-paper p-4"><p className="eyebrow">Recorded</p><p className="mt-2 font-display text-2xl font-semibold text-ink">{todayAttendance.length}</p></div>
              <div className="rounded-md border border-line bg-paper p-4"><p className="eyebrow">Subjects</p><p className="mt-2 font-display text-2xl font-semibold text-ink">{subjectWise.length}</p></div>
            </div>
            <div className="mt-5"><Prediction prediction={prediction} /></div>
          </div>
        </div>
      </Card>

      <nav className="grid gap-3 sm:grid-cols-3" aria-label="Student actions">
        {QUICK_ACTIONS.map(({ to, icon: Icon, title, subtitle }) => (
          <Link key={to} to={to} className="group flex items-center gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent/40 hover:bg-accent-light/40">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent"><Icon size={18} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{title}</strong><span className="truncate text-xs text-slate">{subtitle}</span></span>
            <ArrowRight size={14} className="shrink-0 text-slate/60 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </Link>
        ))}
      </nav>

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="eyebrow">Schedule</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-ink">{DAY_LABEL[todayDay] || 'Today'} · {format(new Date(), 'MMM d, yyyy')}</h2>
          </div>
          <Link to="/student/timetable" className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:text-accent">Full timetable <ArrowRight size={12} /></Link>
        </div>
        <div className="pt-2"><TimetableRows timetable={timetable} todayDay={todayDay} todayAttendance={todayAttendance} /></div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <div className="border-b border-line pb-4"><p className="eyebrow">By subject</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">Subject attendance</h2></div>
          <div className="pt-5">{subjectWise.length ? <SubjectAttendanceChart data={subjectWise} /> : <EmptyState title="No subject data yet" message="This chart appears after attendance is recorded." />}</div>
        </Card>
        <Card className="min-w-0 p-5">
          <div className="border-b border-line pb-4"><p className="eyebrow">Over time</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">Monthly trend</h2></div>
          <div className="pt-5">{monthly.length ? <MonthlyAttendanceChart data={monthly} /> : <EmptyState title="No monthly data yet" message="Trends appear after a few weeks." />}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-end justify-between border-b border-line pb-4">
          <div><p className="eyebrow">Record history</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">Recent attendance</h2></div>
          <Link to="/student/attendance" className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:text-accent">View all <ArrowRight size={13} /></Link>
        </div>
        {recentHistory.length === 0 ? (
          <div className="py-7"><EmptyState title="No history yet" message="Your attendance records will appear here." /></div>
        ) : (
          <div className="divide-y divide-line">
            {recentHistory.slice(0, 8).map((record) => (
              <div key={record._id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full status-dot-${record.status}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{record.subject?.name || 'Subject'}</p>
                    <p className="text-xs text-slate">{formatCalendarDate(record.date, 'MMM d')} · {record.periodName || 'Session'}</p>
                  </div>
                </div>
                <Badge variant={record.status}>{record.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
