import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion.js';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, GripVertical, CalendarClock, Coffee, BookOpenCheck } from 'lucide-react';
import { periodApi } from '../../api/academicsExtra.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABEL = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function emptyPeriod(order) {
  return { order, name: `Period ${order}`, kind: 'class', startTime: '', endTime: '' };
}

export default function PeriodsPage() {
  const { user } = useAuth();
  const canEdit = ['super_admin', 'admin'].includes(user?.role);
  const [activeDay, setActiveDay] = useState('monday');
  const [templates, setTemplates] = useState({}); // { monday: [periods], ... }
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState([]);

  async function loadTemplates() {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await periodApi.listActive();
      const map = {};
      (data?.data?.templates || []).forEach((t) => { map[t.dayOfWeek] = t.periods; });
      setTemplates(map);
    } catch (err) {
      setTemplates({});
      setLoadError(err.response?.data?.message || 'Could not load timetable templates.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadTemplates(); }, []);

  useEffect(() => {
    setDraft(templates[activeDay] ? [...templates[activeDay]].sort((a, b) => a.order - b.order) : []);
  }, [activeDay, templates]);

  function addPeriod() {
    const nextOrder = draft.length > 0 ? Math.max(...draft.map((p) => p.order)) + 1 : 1;
    setDraft([...draft, emptyPeriod(nextOrder)]);
  }

  function updatePeriod(index, field, value) {
    setDraft((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function removePeriod(index) {
    setDraft((prev) => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, order: i + 1 })));
  }

  async function handleSave() {
    if (draft.length === 0) {
      toast.error('Add at least one period before saving.');
      return;
    }
    setIsSaving(true);
    try {
      await periodApi.upsert({ dayOfWeek: activeDay, periods: draft });
      toast.success(`${DAY_LABEL[activeDay]}'s timetable saved`);
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save timetable');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Period Timetable</h1>
          <p className="mt-1 text-sm text-slate">{canEdit ? 'Configure how many periods each day has, and what they are called.' : 'View the institution timetable. Editing is managed by administrators.'}</p>
        </div>
        {!canEdit && <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-slate">Read-only view</span>}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeDay === day ? 'bg-ink text-paper' : 'bg-white text-ink/70 hover:bg-ink/5 border border-ink/8'
            }`}
          >
            {DAY_LABEL[day]}
            {templates[day] && (
              <span className="ml-1.5 text-xs opacity-60">({templates[day].length})</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonCard />
      ) : loadError ? (
        <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert">
          <h2 className="font-semibold text-clay">Could not load timetable</h2>
          <p className="mt-1 text-sm text-clay/80">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={loadTemplates}>Try again</Button>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-ink/50" />
              <h2 className="font-display text-base font-semibold text-ink">{DAY_LABEL[activeDay]}'s periods</h2>
            </div>
            {canEdit && <Button type="button" size="sm" variant="outline" icon={Plus} onClick={addPeriod}>Add period</Button>}
          </div>

          {draft.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No periods configured"
              message={canEdit ? "Add periods to build this day's schedule." : 'No periods have been configured for this day.'}
              action={canEdit ? <Button type="button" icon={Plus} onClick={addPeriod}>Add period</Button> : undefined}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {draft.map((period, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-2.5 rounded-xl border border-ink/10 bg-white p-3"
                >
                  <GripVertical size={15} className="shrink-0 text-ink/20" />
                  <span className="w-7 shrink-0 text-center font-mono text-xs text-slate">{period.order}</span>

                  <input
                    value={period.name}
                    onChange={(e) => updatePeriod(index, 'name', e.target.value)}
                    disabled={!canEdit}
                    className="min-w-[120px] flex-1 rounded-lg border border-ink/15 px-2.5 py-1.5 text-sm focus:border-ink/40 focus:outline-none disabled:bg-paper-dim disabled:text-slate"
                    placeholder="Period name"
                  />

                  <button
                    type="button"
                    type="button"
                    disabled={!canEdit}
                    onClick={() => updatePeriod(index, 'kind', period.kind === 'class' ? 'break' : 'class')}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70 ${
                      period.kind === 'class' ? 'bg-sage-light text-sage' : 'bg-amber-light/40 text-amber'
                    }`}
                  >
                    {period.kind === 'class' ? <BookOpenCheck size={13} /> : <Coffee size={13} />}
                    {period.kind === 'class' ? 'Class period' : 'Break'}
                  </button>

                  <input
                    type="time"
                    value={period.startTime || ''}
                    onChange={(e) => updatePeriod(index, 'startTime', e.target.value)}
                    disabled={!canEdit}
                    className="w-28 shrink-0 rounded-lg border border-ink/15 px-2 py-1.5 text-xs focus:border-ink/40 focus:outline-none disabled:bg-paper-dim disabled:text-slate"
                  />
                  <span className="shrink-0 text-xs text-slate">to</span>
                  <input
                    type="time"
                    value={period.endTime || ''}
                    onChange={(e) => updatePeriod(index, 'endTime', e.target.value)}
                    disabled={!canEdit}
                    className="w-28 shrink-0 rounded-lg border border-ink/15 px-2 py-1.5 text-xs focus:border-ink/40 focus:outline-none disabled:bg-paper-dim disabled:text-slate"
                  />

                  {canEdit && (
                    <button
                      type="button"
                      title="Remove period"
                      aria-label={`Remove ${period.name || `period ${period.order}`}`}
                      onClick={() => removePeriod(index)}
                      className="ml-auto shrink-0 rounded-lg p-1.5 text-ink/40 hover:bg-clay-light hover:text-clay"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={handleSave} isLoading={isSaving} disabled={draft.length === 0}>
                Save {DAY_LABEL[activeDay]}'s timetable
              </Button>
            </div>
          )}
        </Card>
      )}
    </motion.div>
  );
}
