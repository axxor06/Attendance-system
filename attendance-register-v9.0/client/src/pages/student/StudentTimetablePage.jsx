import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, Coffee, BookOpenCheck } from 'lucide-react';
import { periodApi } from '../../api/academicsExtra.js';
import Card from '../../components/common/Card.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABEL = {
  monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday',
  thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday',
};
const DAY_SHORT = {
  monday:'Mon', tuesday:'Tue', wednesday:'Wed',
  thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun',
};

function getTodayName() {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return days[new Date().getDay()];
}

export default function StudentTimetablePage() {
  const [templates, setTemplates] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeDay, setActiveDay] = useState(getTodayName());
  const todayName = getTodayName();

  const loadTimetable = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await periodApi.listActive();
      const map = {};
      (data?.data?.templates || []).forEach((template) => { map[template.dayOfWeek] = template.periods || []; });
      setTemplates(map);
    } catch (err) {
      setTemplates({});
      setLoadError(err.response?.data?.message || 'Page could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTimetable(); }, [loadTimetable]);

  const activePeriods = templates[activeDay] || [];
  const configuredDays = DAYS.filter(d => templates[d]);

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Timetable</h1>
        <p className="mt-1 text-sm text-slate">Period schedule configured by your HOD</p>
      </div>

      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map(day => {
          const hasData = !!templates[day];
          const isToday = day === todayName;
          const isActive = day === activeDay;
          return (
            <motion.button
              key={day}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setActiveDay(day)}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-4 py-2.5 transition-all ${
                isActive
                  ? 'bg-ink text-paper shadow-md'
                  : hasData
                    ? 'border border-ink/10 bg-white text-ink hover:border-ink/20'
                    : 'border border-ink/6 bg-paper-dim text-slate/40'
              }`}
            >
              <span className="text-xs font-semibold">{DAY_SHORT[day]}</span>
              {isToday && (
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-amber' : 'bg-amber'}`} />
              )}
              {!isToday && hasData && (
                <span className="text-[10px] font-medium opacity-60">{templates[day]?.length}p</span>
              )}
            </motion.button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : loadError ? (
        <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert">
          <p className="font-semibold text-clay">Page could not be loaded.</p>
          <p className="mt-1 text-sm text-clay/80">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={loadTimetable}>Try again</Button>
        </Card>
      ) : activePeriods.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`No timetable for ${DAY_LABEL[activeDay]}`}
          message="The HOD has not configured periods for this day yet."
        />
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-semibold text-ink">{DAY_LABEL[activeDay]}</h2>
              {activeDay === todayName && (
                <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">
                  Today
                </span>
              )}
            </div>
            <p className="text-xs text-slate">{activePeriods.length} period{activePeriods.length !== 1 ? 's' : ''}</p>
          </div>

          <motion.div
            className="flex flex-col gap-2.5"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            key={activeDay}
          >
            {activePeriods.map((period, i) => {
              const isBreak = period.kind === 'break';
              return (
                <motion.div
                  key={period.order}
                  variants={staggerItem}
                  className={`flex items-center gap-4 rounded-2xl px-5 py-4 ${
                    isBreak
                      ? 'border border-dashed border-ink/10 bg-paper-dim/50'
                      : 'border border-ink/8 bg-white shadow-sm'
                  }`}
                >
                  {/* Period number badge */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold ${
                    isBreak ? 'bg-ink/6 text-slate/60' : 'bg-ink text-paper'
                  }`}>
                    {isBreak ? <Coffee size={15} /> : period.order}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${isBreak ? 'text-slate/60' : 'text-ink'}`}>
                      {period.name}
                    </p>
                    {(period.startTime || period.endTime) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate">
                        <Clock size={11} />
                        {period.startTime}
                        {period.startTime && period.endTime ? ' – ' : ''}
                        {period.endTime}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isBreak ? (
                      <span className="rounded-full bg-ink/6 px-3 py-1 text-[11px] font-medium text-slate/60">
                        Break
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-sage/12 px-3 py-1 text-[11px] font-medium text-sage">
                        <BookOpenCheck size={11} />
                        Class
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Summary */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-ink/8 bg-white px-4 py-3 text-center">
              <p className="font-display text-xl font-semibold text-ink">
                {activePeriods.filter(p => p.kind === 'class').length}
              </p>
              <p className="text-xs text-slate">Class periods</p>
            </div>
            <div className="rounded-xl border border-ink/8 bg-white px-4 py-3 text-center">
              <p className="font-display text-xl font-semibold text-ink">
                {activePeriods.filter(p => p.kind === 'break').length}
              </p>
              <p className="text-xs text-slate">Breaks</p>
            </div>
          </div>
        </div>
      )}

      {configuredDays.length === 0 && !isLoading && (
        <EmptyState
          icon={CalendarDays}
          title="No timetable configured"
          message="Your HOD hasn't set up the period timetable yet. Check back later."
        />
      )}
    </motion.div>
  );
}
