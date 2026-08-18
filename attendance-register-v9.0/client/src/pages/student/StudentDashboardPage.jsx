import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, AlertTriangle, BookOpen, QrCode, CalendarDays,
  Clock, Target, CheckCircle2, XCircle, Coffee, ArrowRight,
  Zap, Award, RefreshCw
} from 'lucide-react';
import { dashboardApi } from '../../api/misc.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import StatCard from '../../components/dashboard/StatCard.jsx';
import QuickActionGrid from '../../components/dashboard/QuickActionGrid.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import SubjectAttendanceChart from '../../components/charts/SubjectAttendanceChart.jsx';
import MonthlyAttendanceChart from '../../components/charts/MonthlyAttendanceChart.jsx';
import { staggerContainer, fadeUp } from '../../utils/motion.js';

const DAY_LABEL = { monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday', thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday' };
function AttendanceRing({ percentage }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (percentage / 100) * circ;
  const color = percentage < 75 ? '#B5564E' : percentage < 85 ? '#B27A35' : '#3F766D';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="136" height="136" className="-rotate-90">
        <circle cx="68" cy="68" r={r} fill="none" stroke="rgba(22,43,73,0.06)" strokeWidth="12" />
        <motion.circle
          cx="68" cy="68" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute text-center">
        <motion.p
          className="font-display text-3xl font-bold text-ink"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {percentage}%
        </motion.p>
        <p className="text-[11px] font-medium text-slate">attendance</p>
      </div>
    </div>
  );
}

function TimetableCard({ timetable, todayDay, todayAttendance }) {
  if (!timetable || timetable.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={`No timetable for ${DAY_LABEL[todayDay] || 'today'}`}
        message="The HOD has not configured periods for this day yet."
      />
    );
  }

  const attendanceByPeriod = {};
  todayAttendance?.forEach(a => { attendanceByPeriod[a.periodOrder] = a; });

  return (
    <div className="flex flex-col gap-2">
      {timetable.map((period, i) => {
        const record = attendanceByPeriod[period.order];
        const isBreak = period.kind === 'break';

        return (
          <motion.div
            key={period.order}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
              isBreak ? 'bg-paper-dim/60' : 'border border-ink/8 bg-white'
            }`}
          >
            <div className="flex w-7 shrink-0 items-center justify-center">
              {isBreak
                ? <Coffee size={15} className="text-slate/50" />
                : record
                  ? record.status === 'present' || record.status === 'late'
                    ? <CheckCircle2 size={16} className="text-sage" />
                    : <XCircle size={16} className="text-clay" />
                  : <Clock size={15} className="text-slate/50" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${isBreak ? 'text-slate/60' : 'text-ink'}`}>
                {period.name}
              </p>
              {(period.startTime || period.endTime) && (
                <p className="text-xs text-slate">
                  {period.startTime}{period.startTime && period.endTime ? ' – ' : ''}{period.endTime}
                </p>
              )}
            </div>
            {!isBreak && record && (
              <Badge variant={record.status}>{record.status}</Badge>
            )}
            {!isBreak && !record && (
              <span className="text-xs text-slate/50">Upcoming</span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function PredictionCard({ prediction }) {
  if (!prediction) return null;
  const { needed75, canMiss75, needed85 } = prediction;

  return (
    <div className="flex flex-col gap-3">
      {needed75 > 0 ? (
        <div className="flex items-start gap-3 rounded-xl bg-clay-light px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-clay" />
          <div>
            <p className="text-sm font-semibold text-clay">Below 75% threshold</p>
            <p className="mt-0.5 text-xs text-clay/80">
              Attend <strong>{needed75}</strong> more consecutive class{needed75 !== 1 ? 'es' : ''} to reach 75%
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-sage-light px-4 py-3">
          <Award size={16} className="mt-0.5 shrink-0 text-sage" />
          <div>
            <p className="text-sm font-semibold text-sage">Above threshold ✓</p>
            {canMiss75 > 0 && (
              <p className="mt-0.5 text-xs text-sage/80">
                You can miss up to <strong>{canMiss75}</strong> class{canMiss75 !== 1 ? 'es' : ''} and stay above 75%
              </p>
            )}
          </div>
        </div>
      )}
      {needed85 > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-indigo-light px-4 py-3">
          <Target size={16} className="mt-0.5 shrink-0 text-indigo" />
          <div>
            <p className="text-sm font-semibold text-indigo">To reach 85%</p>
            <p className="mt-0.5 text-xs text-indigo/80">
              Attend <strong>{needed85}</strong> more consecutive class{needed85 !== 1 ? 'es' : ''} to reach 85%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentDashboardPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data: res } = await dashboardApi.student();
      setData(res.data);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load your attendance dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <Card className="border-clay/20 bg-clay-light/60 p-7" role="alert">
        <div className="flex items-start gap-4"><div className="rounded-2xl bg-white/70 p-3 text-clay"><AlertTriangle size={20} aria-hidden="true" /></div><div><p className="font-semibold text-clay">Unable to load your dashboard</p><p className="mt-1 text-sm leading-6 text-clay/80">{loadError || 'No dashboard data is available yet.'}</p><Button type="button" variant="outline" icon={RefreshCw} className="mt-4" onClick={loadDashboard}>Try again</Button></div></div>
      </Card>
    );
  }

  const { overall = {}, subjectWise = [], monthly = [], recentHistory = [], todayAttendance = [],
          timetable = [], prediction, lowAttendanceWarning, studentClass, todayDay } = data;

  const todayPresent = todayAttendance?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
  const todayTotal = todayAttendance?.length || 0;

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">My Dashboard</h1>
          <p className="mt-1 text-sm text-slate">
            {studentClass ? `${studentClass} · ` : ''}
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <Link to="/scan-qr" className="flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-paper shadow-lg transition-all hover:bg-ink-light hover:shadow-xl active:scale-95">
          <QrCode size={18} />
          Scan QR
        </Link>
      </div>

      {/* Low attendance warning banner */}
      {lowAttendanceWarning && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-clay/30 bg-clay-light px-5 py-4"
        >
          <AlertTriangle size={18} className="shrink-0 text-clay" />
          <p className="text-sm font-medium text-clay">
            Your attendance is below 75%. Attend all upcoming classes to avoid academic issues.
          </p>
        </motion.div>
      )}

      {/* Top stats */}
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <StatCard label="Overall Attendance" value={`${overall.percentage}%`}
          sublabel={`${overall.present}/${overall.total} classes`}
          icon={TrendingUp} accent={overall.percentage < 75 ? 'clay' : overall.percentage < 85 ? 'amber' : 'sage'}
          percentage={overall.percentage} />
        <StatCard label="Subjects" value={subjectWise.length} icon={BookOpen} accent="indigo" />
        <StatCard label="Today Present" value={`${todayPresent}/${todayTotal}`}
          sublabel={todayTotal === 0 ? 'No classes marked yet' : `${Math.round((todayPresent/Math.max(todayTotal,1))*100)}% today`}
          icon={CalendarDays} accent="sage" />
        <StatCard label="Status"
          value={overall.percentage >= 75 ? 'On track' : 'Needs attention'}
          icon={overall.percentage >= 75 ? Zap : AlertTriangle}
          accent={overall.percentage >= 75 ? 'sage' : 'clay'} />
      </motion.div>

      <QuickActionGrid actions={[
        { to: '/scan-qr', label: 'Scan attendance QR', description: 'Check in to a live session', icon: QrCode, tone: 'sage' },
        { to: '/student/timetable', label: 'Open timetable', description: 'See today’s periods', icon: CalendarDays, tone: 'indigo' },
        { to: '/student/attendance', label: 'Attendance records', description: 'Review subject history', icon: BookOpen, tone: 'amber' },
        { to: '/student/notifications', label: 'Notifications', description: 'Read recent updates', icon: Award, tone: 'ink' },
      ]} />

      {/* Attendance ring + prediction */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 flex flex-col items-center gap-4">
          <h2 className="self-start font-display text-base font-semibold text-ink">Overall</h2>
          <AttendanceRing percentage={overall.percentage} />
          <div className="grid w-full grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-display text-lg font-semibold text-ink">{overall.total}</p>
              <p className="text-[11px] text-slate">Total</p>
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-sage">{overall.present}</p>
              <p className="text-[11px] text-slate">Present</p>
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-clay">{overall.total - overall.present}</p>
              <p className="text-[11px] text-slate">Absent</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-semibold text-ink">Attendance Prediction</h2>
          <PredictionCard prediction={prediction} />
        </Card>
      </div>

      {/* Today's Timetable */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Today's Timetable</h2>
            <p className="text-xs text-slate capitalize">{DAY_LABEL[todayDay] || 'Today'} · {format(new Date(), 'MMM d, yyyy')}</p>
          </div>
          <CalendarDays size={18} className="text-slate/40" />
        </div>
        <TimetableCard timetable={timetable} todayDay={todayDay} todayAttendance={todayAttendance} />
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Subject-wise attendance</h2>
          {subjectWise.length === 0
            ? <EmptyState title="No data yet" message="Will appear once classes begin." />
            : <SubjectAttendanceChart data={subjectWise} />
          }
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Monthly trend</h2>
          {monthly.length === 0
            ? <EmptyState title="No monthly data yet" message="Trends appear after a few weeks." />
            : <MonthlyAttendanceChart data={monthly} />
          }
        </Card>
      </div>

      {/* Recent history */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Recent history</h2>
          <Link to="/student/attendance" className="flex items-center gap-1 text-xs font-medium text-indigo hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {recentHistory.length === 0
          ? <EmptyState title="No history yet" message="Your attendance records will appear here." />
          : (
            <div className="divide-y divide-ink/5">
              {recentHistory.slice(0, 8).map((r, i) => (
                <motion.div
                  key={r._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-2 w-2 shrink-0 rounded-full status-dot-${r.status}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{r.subject?.name}</p>
                      <p className="text-xs text-slate">{format(new Date(r.date), 'MMM d')} · {r.periodName}</p>
                    </div>
                  </div>
                  <Badge variant={r.status}>{r.status}</Badge>
                </motion.div>
              ))}
            </div>
          )
        }
      </Card>
    </motion.div>
  );
}
