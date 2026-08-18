import { useCallback, useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, CalendarCheck, TrendingUp, AlertTriangle,
  Activity, ArrowRight, CalendarDays, RefreshCw, Building2, Layers3, UserCheck, FileBarChart,
} from 'lucide-react';
import { dashboardApi } from '../../api/misc.js';
import Badge from '../../components/common/Badge.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import StatCard from '../../components/dashboard/StatCard.jsx';
import QuickActionGrid from '../../components/dashboard/QuickActionGrid.jsx';
import AttendanceTrendChart from '../../components/charts/AttendanceTrendChart.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';

function PercentageBar({ percentage = 0, tone = 'sage' }) {
  const color = tone === 'clay' ? 'bg-clay' : tone === 'amber' ? 'bg-amber' : 'bg-sage';
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/8">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }} />
      </div>
      <span className="w-12 text-right text-sm font-semibold text-ink">{percentage}%</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton h-28 rounded-[24px]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-36 rounded-[24px]" />)}</div>
      <div className="grid gap-5 lg:grid-cols-5"><div className="skeleton h-80 rounded-[24px] lg:col-span-2" /><div className="skeleton h-80 rounded-[24px] lg:col-span-3" /></div>
    </div>
  );
}

export default function HodDashboardPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const { data: response } = await dashboardApi.hod();
      setData(response.data);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (isLoading) return <DashboardSkeleton />;

  if (hasError || !data) {
    return (
      <Card className="border-clay/20 bg-clay-light/60 p-7" role="alert">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/70 p-3 text-clay"><AlertTriangle size={20} aria-hidden="true" /></div>
          <div className="flex-1"><p className="font-semibold text-clay">Unable to load the dashboard</p><p className="mt-1 text-sm leading-6 text-clay/80">We could not retrieve the latest attendance data. Try again in a moment.</p><Button type="button" variant="outline" icon={RefreshCw} className="mt-4" onClick={loadDashboard}>Try again</Button></div>
        </div>
      </Card>
    );
  }

  const {
    totals = {}, todayAttendance = {}, monthlyAttendance = {}, lowAttendanceStudents = [],
    lowAttendanceCount = 0, recentActivity = [], attendanceTrend = [],
  } = data;

  return (
    <motion.div className="space-y-6" {...fadeUp}>
      <section className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-7 text-paper shadow-[0_18px_44px_rgba(22,43,73,0.16)] sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-paper/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-4 -top-10 h-36 w-36 rounded-full border border-amber/20" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber">Attendance overview</p>
            <h1 className="max-w-2xl font-display text-3xl font-semibold leading-tight tracking-[-0.04em] text-paper sm:text-4xl">Attendance overview</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-paper/60">Review attendance and follow up with students who need support.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-paper/55"><CalendarDays size={15} className="text-amber" aria-hidden="true" /> {format(new Date(), 'EEEE, d MMMM yyyy')}</div>
        </div>
      </section>

      <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={staggerContainer} initial="initial" animate="animate">
        <StatCard label="Active students" value={totals.totalStudents || 0} sublabel="Currently enrolled" icon={GraduationCap} accent="indigo" />
        <StatCard label="Active faculty" value={totals.totalFaculty || 0} sublabel="Teaching staff" icon={Users} accent="amber" />
        <StatCard label="Today’s attendance" value={`${todayAttendance.percentage || 0}%`} sublabel={`${todayAttendance.present || 0}/${todayAttendance.total || 0} present`} icon={CalendarCheck} accent="sage" percentage={todayAttendance.percentage || 0} />
        <StatCard label="Students to review" value={lowAttendanceCount} sublabel="Below the 75% threshold" icon={AlertTriangle} accent={lowAttendanceCount ? 'clay' : 'sage'} />
      </motion.div>

      <QuickActionGrid actions={[
        { to: '/hod/people', label: 'Review people', description: 'Manage faculty and students', icon: Users, tone: 'indigo' },
        { to: '/hod/registrations', label: 'Review registrations', description: 'Process pending requests', icon: UserCheck, tone: 'amber' },
        { to: '/hod/periods', label: 'Open timetable', description: 'Check today’s periods', icon: CalendarDays, tone: 'sage' },
        { to: '/hod/reports', label: 'Open reports', description: 'Inspect attendance trends', icon: FileBarChart, tone: 'ink' },
      ]} />

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-4 border-b border-ink/8 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate">Attendance snapshot</p><h2 className="mt-2 font-display text-xl font-semibold tracking-[-0.025em] text-ink">Is participation on track?</h2></div><div className="rounded-2xl bg-sage-light p-2.5 text-sage"><TrendingUp size={18} aria-hidden="true" /></div></div>
          <div className="space-y-6 pt-6">
            <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate">Today</span><span className="font-semibold text-ink">{todayAttendance.present || 0} of {todayAttendance.total || 0}</span></div><PercentageBar percentage={todayAttendance.percentage || 0} /></div>
            <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate">This month</span><span className="font-semibold text-ink">{monthlyAttendance.present || 0} of {monthlyAttendance.total || 0}</span></div><PercentageBar percentage={monthlyAttendance.percentage || 0} tone="amber" /></div>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 border-t border-ink/8 pt-5"><div className="flex items-center gap-2"><Building2 size={15} className="text-slate" aria-hidden="true" /><div><p className="text-xs text-slate">Departments</p><p className="mt-1 text-lg font-semibold text-ink">{totals.totalDepartments || 0}</p></div></div><div className="flex items-center gap-2"><Layers3 size={15} className="text-slate" aria-hidden="true" /><div><p className="text-xs text-slate">Classes</p><p className="mt-1 text-lg font-semibold text-ink">{totals.totalClasses || 0}</p></div></div></div>
        </Card>

        <Card className="p-6 lg:col-span-3">
          <div className="flex items-start justify-between gap-4 border-b border-ink/8 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate">Trend</p><h2 className="mt-2 font-display text-xl font-semibold tracking-[-0.025em] text-ink">14-day attendance</h2></div><Link to="/hod/reports" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink transition hover:bg-paper hover:text-amber">Open reports <ArrowRight size={13} aria-hidden="true" /></Link></div>
          <div className="pt-5">{attendanceTrend.length === 0 ? <EmptyState icon={CalendarCheck} title="No attendance data yet" message="The trend will appear once faculty begin marking attendance." /> : <AttendanceTrendChart data={attendanceTrend} />}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink/8 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate">Intervention queue</p><h2 className="mt-2 font-display text-xl font-semibold tracking-[-0.025em] text-ink">Students needing attention</h2></div><div className="flex items-center gap-3"><Badge variant={lowAttendanceCount ? 'absent' : 'present'}>{lowAttendanceCount} flagged</Badge><Link to="/hod/people" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink hover:bg-paper hover:text-amber">View people <ArrowRight size={13} aria-hidden="true" /></Link></div></div>
        {lowAttendanceStudents.length === 0 ? <div className="px-6 py-8"><EmptyState icon={AlertTriangle} title="All clear" message="No students are below the 75% attendance threshold." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left"><caption className="sr-only">Students below attendance threshold</caption><thead className="bg-paper"><tr className="text-[11px] uppercase tracking-[0.14em] text-slate"><th className="px-6 py-3 font-bold">Student</th><th className="px-4 py-3 font-bold">Register no.</th><th className="px-4 py-3 font-bold">Class</th><th className="px-4 py-3 font-bold">Attendance</th><th className="px-6 py-3 text-right font-bold">Status</th></tr></thead><tbody className="divide-y divide-ink/8">{lowAttendanceStudents.map((student) => { const tone = student.percentage < 60 ? 'absent' : 'amber'; return <tr key={student.studentId} className="transition-colors hover:bg-paper/70"><td className="px-6 py-4"><p className="text-sm font-semibold text-ink">{student.name}</p></td><td className="px-4 py-4 text-sm text-slate">{student.registerNumber || '—'}</td><td className="px-4 py-4 text-sm text-slate">{student.className || '—'}</td><td className="px-4 py-4"><PercentageBar percentage={student.percentage} tone={tone === 'absent' ? 'clay' : 'amber'} /></td><td className="px-6 py-4 text-right"><Badge variant={tone}>{student.percentage < 60 ? 'Critical' : 'Review'}</Badge></td></tr>; })}</tbody></table></div>}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink/8 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate">Audit trail</p><h2 className="mt-2 font-display text-xl font-semibold tracking-[-0.025em] text-ink">Recent activity</h2></div><div className="rounded-2xl bg-paper p-2.5 text-slate"><Activity size={18} aria-hidden="true" /></div></div>
        {recentActivity.length === 0 ? <div className="px-6 py-8"><EmptyState title="No activity yet" message="Important actions across the system will appear here." /></div> : <div className="divide-y divide-ink/8">{recentActivity.map((activity, index) => <motion.div key={activity._id} variants={staggerItem} initial="initial" animate="animate" custom={index} className="flex items-center justify-between gap-4 px-6 py-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink/8 text-xs font-bold text-ink">{activity.actor?.name?.[0]?.toUpperCase() || 'S'}</div><p className="truncate text-sm text-ink"><span className="font-semibold">{activity.actor?.name || 'System'}</span> {activity.description}</p></div><span className="shrink-0 text-xs text-slate">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span></motion.div>)}</div>}
      </Card>
    </motion.div>
  );
}
