import { getFriendlyError } from '../../utils/errorMessages.js';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, Coffee, BookOpenCheck, UserRound } from 'lucide-react';
import { timetableApi } from '../../api/workflows.js';
import { periodApi } from '../../api/academicsExtra.js';
import Card from '../../components/common/Card.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABEL = Object.fromEntries(DAYS.map((day) => [day, day[0].toUpperCase() + day.slice(1)]));
const DAY_SHORT = Object.fromEntries(DAYS.map((day) => [day, day.slice(0, 3)]));

function getTodayName() {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
}


export default function StudentTimetablePage() {
  const [timetable, setTimetable] = useState(null);
  const [days, setDays] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeDay, setActiveDay] = useState(getTodayName());
  const todayName = getTodayName();

  const loadTimetable = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await timetableApi.list();
      const nextTimetable = data?.data?.timetables?.[0] || null;
      if (nextTimetable) {
        setTimetable(nextTimetable);
        setDays(Object.fromEntries((nextTimetable.days || []).map((day) => [day.dayOfWeek, day.slots || []])));
      } else {
        // Legacy fallback keeps older seeded classes readable until HOD creates
        // their class-specific timetable.
        const legacy = await periodApi.listActive();
        const map = {};
        (legacy.data?.data?.templates || []).forEach((template) => { map[template.dayOfWeek] = template.periods || []; });
        setTimetable(null);
        setDays(map);
      }
    } catch (err) {
      setTimetable(null);
      setDays({});
      setLoadError(getFriendlyError(err, 'Your timetable could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  const activePeriods = days[activeDay] || [];
  const configuredDays = DAYS.filter((day) => Object.prototype.hasOwnProperty.call(days, day));

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <header className="border-b border-line pb-6"><p className="eyebrow">Your academic schedule</p><h1 className="page-title mt-2">Timetable</h1><p className="page-lede mt-2">{timetable?.class?.name ? `${timetable.class.name} · ` : ''}See the subject and Faculty assigned to each class period.</p></header>
      <div className="flex gap-2 overflow-x-auto pb-1">{DAYS.map((day) => { const hasData = !!days[day]; const isToday = day === todayName; const isActive = day === activeDay; return <motion.button key={day} whileTap={{ scale: 0.95 }} type="button" onClick={() => setActiveDay(day)} className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-4 py-2.5 transition-colors ${isActive ? 'bg-ink text-paper' : hasData ? 'border border-line bg-surface text-ink hover:border-ink/25' : 'border border-line/60 bg-paper-dim text-slate/50'}`}><span className="text-xs font-semibold">{DAY_SHORT[day]}</span>{isToday && <span className="h-1.5 w-1.5 rounded-full bg-amber" />}{!isToday && hasData && <span className="text-[10px] font-medium opacity-65">{days[day].length}p</span>}</motion.button>; })}</div>
      {isLoading ? <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</div> : loadError ? <Card className="notice-error p-6" role="alert"><p className="font-semibold">Timetable unavailable</p><p className="mt-1 text-sm">{loadError}</p><Button type="button" variant="outline" className="mt-4" onClick={loadTimetable}>Try again</Button></Card> : activePeriods.length === 0 ? <EmptyState icon={CalendarDays} title={`No timetable for ${DAY_LABEL[activeDay]}`} message="Your HOD has not configured periods for this day yet." /> : <section><div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold text-ink">{DAY_LABEL[activeDay]}</h2>{activeDay === todayName && <span className="mt-1 inline-block rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">Today</span>}</div><p className="text-xs text-slate">{activePeriods.length} period{activePeriods.length === 1 ? '' : 's'}</p></div><motion.div className="flex flex-col gap-3" variants={staggerContainer} initial="initial" animate="animate" key={activeDay}>{activePeriods.map((period) => { const isBreak = period.kind === 'break'; return <motion.div key={period._id || period.order} variants={staggerItem} className={`flex min-w-0 items-start gap-4 rounded-xl border px-4 py-4 sm:px-5 ${isBreak ? 'border-dashed border-line bg-paper-dim/55' : 'border-line bg-surface shadow-sm'}`}><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${isBreak ? 'bg-ink/5 text-slate' : 'bg-ink text-paper'}`}>{isBreak ? <Coffee size={15} /> : period.order}</div><div className="min-w-0 flex-1"><p className={`font-semibold ${isBreak ? 'text-slate' : 'text-ink'}`}>{period.name}</p>{(period.startTime || period.endTime) && <p className="mt-1 flex items-center gap-1 text-xs text-slate"><Clock size={11} />{period.startTime}{period.startTime && period.endTime ? ' – ' : ''}{period.endTime}</p>}{!isBreak && <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-2"><BookOpenCheck size={14} className="shrink-0 text-amber" /><span className="truncate text-ink">{period.subject?.name || 'Subject not assigned'}</span></div><div className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-2"><UserRound size={14} className="shrink-0 text-sage" /><span className="truncate text-ink">{period.faculty?.name || 'Faculty not assigned'}</span></div></div>}{period.note && <p className="mt-2 text-xs text-slate">{period.note}</p>}</div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isBreak ? 'bg-ink/5 text-slate' : 'bg-sage-light/70 text-sage'}`}>{isBreak ? 'Break' : 'Class'}</span></motion.div>; })}</motion.div><div className="mt-4 grid grid-cols-2 gap-3"><div className="metric-strip"><p className="font-display text-xl font-semibold text-ink">{activePeriods.filter((period) => period.kind !== 'break').length}</p><p className="text-xs text-slate">Class periods</p></div><div className="metric-strip"><p className="font-display text-xl font-semibold text-ink">{activePeriods.filter((period) => period.kind === 'break').length}</p><p className="text-xs text-slate">Breaks</p></div></div></section>}
      {!isLoading && configuredDays.length === 0 && <EmptyState icon={CalendarDays} title="No timetable configured" message="Your HOD has not set up the weekly class schedule yet." />}
    </motion.div>
  );
}
