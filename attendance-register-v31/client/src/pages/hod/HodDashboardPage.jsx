import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, ArrowUpRight, Building2, CalendarCheck2, CalendarDays, FileBarChart2, GraduationCap, RefreshCw, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardApi } from '../../api/misc.js';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import AttendanceTrendChart from '../../components/charts/AttendanceTrendChart.jsx';
import { fadeUp } from '../../utils/motion.js';
import { getFriendlyError } from '../../utils/errorMessages.js';

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading HOD dashboard">
      <div className="skeleton h-20" />
      <div className="skeleton h-80" />
      <div className="skeleton h-40" />
      <div className="skeleton h-72" />
    </div>
  );
}

/** Big inline numbers with hairline dividers instead of a row of identical
    boxed cards - reads as one connected statement about the institution,
    not four interchangeable dashboard widgets. */
function StatStrip({ items }) {
  return (
    <div className="flex flex-wrap items-stretch divide-x divide-line border-y border-line">
      {items.map(({ label, value, to }) => {
        const inner = (
          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5 px-5 py-5 sm:px-7">
            <p className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold leading-none tracking-[-0.03em] text-ink">{value}</p>
            <p className="flex items-center gap-1 text-xs font-medium text-slate">{label}{to && <ArrowUpRight size={12} className="text-slate/60" />}</p>
          </div>
        );
        return to
          ? <Link key={label} to={to} className="group transition-colors hover:bg-paper-dim/50">{inner}</Link>
          : <div key={label}>{inner}</div>;
      })}
    </div>
  );
}

/** Dominant hero band for the one number that actually matters most on an
    attendance platform - a real radial dial, not a thin progress rule
    sitting inside a card equal in weight to three other cards. */
function AttendanceHero({ today = {}, monthly = {}, lowAttendanceCount }) {
  const percentage = Math.max(0, Math.min(100, Number(today.percentage || 0)));
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const color = percentage < 60 ? 'var(--color-clay)' : percentage < 75 ? 'var(--color-amber)' : 'var(--color-sage)';

  return (
    <section className="grid overflow-hidden border border-line bg-surface shadow-sm lg:grid-cols-[auto_1px_1fr]">
      <div className="flex flex-col items-center justify-center gap-2 p-8">
        <div className="relative flex items-center justify-center">
          <svg width="176" height="176" className="-rotate-90" role="img" aria-label={`${percentage}% attendance today`}>
            <circle cx="88" cy="88" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="11" />
            <motion.circle
              cx="88" cy="88" r={radius} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - ((percentage / 100) * circumference) }}
              transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
            />
          </svg>
          <div className="absolute text-center">
            <p className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink">{percentage}%</p>
            <p className="text-[11px] text-slate">today</p>
          </div>
        </div>
        <p className="mt-1 text-center text-xs text-slate">{today.present || 0} present of {today.total || 0} recorded</p>
      </div>

      <div className="hidden bg-line lg:block" />

      <div className="border-t border-line p-6 lg:border-t-0 lg:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Today across the institution</p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Attendance pulse</h2>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate"><CalendarDays size={14} />{format(new Date(), 'd MMM')}</span>
        </div>
        <p className="mt-2 text-sm text-slate">A live view of records marked today, not a projected value.</p>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5">
          <div><p className="font-display text-xl font-semibold text-ink">{monthly.percentage || 0}%</p><p className="mt-1 text-xs text-slate">This month</p></div>
          <div><p className="font-display text-xl font-semibold text-ink">{monthly.total || 0}</p><p className="mt-1 text-xs text-slate">Monthly records</p></div>
          <Link to="/hod/students" className="group">
            <p className={`font-display text-xl font-semibold ${lowAttendanceCount ? 'text-clay' : 'text-ink'}`}>{lowAttendanceCount}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate group-hover:text-accent">Review queue <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" /></p>
          </Link>
        </div>
      </div>
    </section>
  );
}

function QuickActions() {
  const actions = [
    ['Students', '/hod/students', GraduationCap],
    ['Faculty', '/hod/faculty', UsersRound],
    ['Tutors', '/hod/tutors', UsersRound],
    ['Academic structure', '/hod/academics', Building2],
    ['Reports', '/hod/reports', FileBarChart2],
  ];
  return (
    <nav className="flex flex-wrap gap-2" aria-label="HOD actions">
      {actions.map(([label, to, Icon]) => (
        <Link key={to} to={to} className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface py-2 pl-2 pr-4 text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:bg-accent-light/40">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-paper transition-colors group-hover:bg-accent"><Icon size={13} /></span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function FlaggedStudents({ students, count }) {
  return (
    <section className="min-w-0 border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="eyebrow">Intervention queue</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">Students needing attention</h2></div>
        <div className="flex items-center gap-3">
          <Badge variant={count ? 'absent' : 'present'}>{count} flagged</Badge>
          <Link to="/hod/students" className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:text-accent">Open students <ArrowRight size={13} /></Link>
        </div>
      </div>
      {students.length === 0 ? (
        <div className="px-5 py-8"><EmptyState icon={AlertTriangle} title="No students flagged" message="No recorded attendance is below the review threshold." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="directory-table min-w-[650px] w-full text-sm">
            <caption className="sr-only">Students below attendance threshold</caption>
            <thead><tr><th>Student</th><th>Register number</th><th>Class</th><th>Attendance</th><th>Status</th></tr></thead>
            <tbody>
              {students.slice(0, 10).map((student) => (
                <tr key={student.studentId}>
                  <td className="font-semibold text-ink">{student.name}</td>
                  <td className="ledger-number text-xs text-slate">{student.registerNumber || '—'}</td>
                  <td className="text-slate">{student.className || '—'}</td>
                  <td className="font-semibold text-ink">{student.percentage}%</td>
                  <td><Badge variant={student.percentage < 60 ? 'absent' : 'late'}>{student.percentage < 60 ? 'Critical' : 'Review'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ActivityList({ activities }) {
  return (
    <section className="min-w-0 border border-line bg-surface">
      <div className="border-b border-line px-5 py-5"><p className="eyebrow">Audit trail</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">Recent activity</h2></div>
      {activities.length === 0 ? (
        <div className="px-5 py-8"><EmptyState title="No recent activity" message="Important institution actions will appear here." /></div>
      ) : (
        <div className="divide-y divide-line">
          {activities.slice(0, 6).map((activity) => (
            <div key={activity._id} className="flex items-start gap-3 px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-dim text-xs font-bold text-ink">{activity.actor?.name?.[0]?.toUpperCase() || 'S'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-5 text-ink"><strong>{activity.actor?.name || 'System'}</strong> {activity.description}</p>
                <p className="mt-1 text-xs text-slate">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function HodDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data: response } = await dashboardApi.hod();
      setData(response.data);
    } catch (err) {
      setError(getFriendlyError(err, 'We could not retrieve the latest institution data. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) {
    return (
      <div className="notice-error" role="alert">
        <AlertTriangle size={18} />
        <div className="flex-1">
          <p className="font-semibold">Unable to load the HOD overview</p>
          <p className="mt-1 text-sm">{error || 'No dashboard data was returned.'}</p>
          <Button type="button" variant="outline" icon={RefreshCw} className="mt-4" onClick={loadDashboard}>Try again</Button>
        </div>
      </div>
    );
  }

  const { totals = {}, todayAttendance = {}, monthlyAttendance = {}, lowAttendanceStudents = [], lowAttendanceCount = 0, recentActivity = [], attendanceTrend = [] } = data;

  return (
    <motion.div className="space-y-7" {...fadeUp}>
      <header>
        <p className="eyebrow text-accent">Head of Department workspace</p>
        <h1 className="page-title mt-2">Institution overview</h1>
        <p className="page-lede mt-2">Good to see you, {user?.name?.split(' ')?.[0] || 'there'}. Your authorized view spans academics, accounts, and attendance.</p>
      </header>

      <StatStrip items={[
        { label: 'Enrolled learners', value: totals.totalStudents || 0, to: '/hod/students' },
        { label: 'Teaching staff', value: totals.totalFaculty || 0, to: '/hod/faculty' },
        { label: 'Academic departments', value: totals.totalDepartments || 0, to: '/hod/academics' },
        { label: 'Active class groups', value: totals.totalClasses || 0, to: '/hod/academics' },
      ]} />

      <AttendanceHero today={todayAttendance} monthly={monthlyAttendance} lowAttendanceCount={lowAttendanceCount} />

      <QuickActions />

      <section className="min-w-0 border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <div><p className="eyebrow">Attendance trend</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">Last fourteen days</h2></div>
          <Link to="/hod/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:text-accent">Open reports <ArrowRight size={13} /></Link>
        </div>
        <div className="pt-5">{attendanceTrend.length ? <AttendanceTrendChart data={attendanceTrend} /> : <EmptyState icon={CalendarCheck2} title="No trend data yet" message="The chart will appear after attendance is recorded." />}</div>
      </section>

      <FlaggedStudents students={lowAttendanceStudents} count={lowAttendanceCount} />
      <ActivityList activities={recentActivity} />
    </motion.div>
  );
}
