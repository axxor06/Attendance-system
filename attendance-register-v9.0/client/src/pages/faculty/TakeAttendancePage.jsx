import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, X, Clock3, FileQuestion, Save, Users, CheckSquare } from 'lucide-react';
import { subjectApi } from '../../api/academicsExtra.js';
import { periodApi } from '../../api/academicsExtra.js';
import { attendanceApi } from '../../api/attendance.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';
import Input from '../../components/common/Input.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';

const STATUS_OPTIONS = [
  { value: 'present', label: 'P', fullLabel: 'Present', activeClass: 'bg-sage text-white' },
  { value: 'absent',  label: 'A', fullLabel: 'Absent',  activeClass: 'bg-clay text-white' },
  { value: 'late',    label: 'L', fullLabel: 'Late',    activeClass: 'bg-amber text-ink' },
  { value: 'excused', label: 'E', fullLabel: 'Excused', activeClass: 'bg-slate text-white' },
];

function todayIso() { return format(new Date(), 'yyyy-MM-dd'); }
function getDayName(dateStr) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return days[new Date(dateStr).getDay()];
}

export default function TakeAttendancePage() {
  const [searchParams] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [dayPeriods, setDayPeriods] = useState([]);
  const [optionsError, setOptionsError] = useState('');
  const [rosterError, setRosterError] = useState('');
  const [date, setDate] = useState(todayIso());
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') || '');
  const [periodOrder, setPeriodOrder] = useState(searchParams.get('periodOrder') || '');
  const [roster, setRoster] = useState(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadSubjects = useCallback(async () => {
    try {
      const { data } = await subjectApi.mySubjects();
      setSubjects(data?.data?.subjects || []);
    } catch (err) {
      setSubjects([]);
      setOptionsError(err.response?.data?.message || 'Could not load subjects.');
    }
  }, []);

  const loadPeriods = useCallback(async () => {
    if (!date) return;
    try {
      const { data } = await periodApi.getByDay(getDayName(date));
      setDayPeriods(data?.data?.template?.periods?.filter((period) => period.kind === 'class') || []);
    } catch (err) {
      setDayPeriods([]);
      setOptionsError(err.response?.data?.message || 'Could not load periods.');
    }
  }, [date]);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);
  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const loadRoster = useCallback(async () => {
    if (!subjectId || !date || !periodOrder) return;
    setIsLoadingRoster(true); setRoster(null); setRosterError('');
    try {
      const { data } = await attendanceApi.sessionRoster({ subjectId, date, periodOrder });
      setRoster(data.data);
    } catch (err) {
      const message = err.response?.data?.message || 'Could not load roster';
      setRosterError(message);
      toast.error(message);
    } finally { setIsLoadingRoster(false); }
  }, [subjectId, date, periodOrder]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  function setStatus(studentId, status) {
    setRoster(prev => ({
      ...prev,
      roster: prev.roster.map(r => r.studentId === studentId ? { ...r, status } : r),
    }));
  }

  function markAll(status) {
    setRoster(prev => ({ ...prev, roster: prev.roster.map(r => ({ ...r, status })) }));
  }

  const presentCount = roster?.roster?.filter(r => r.status === 'present' || r.status === 'late').length || 0;
  const totalCount = roster?.roster?.length || 0;

  async function handleSave() {
    const entries = roster.roster.filter(r => r.status).map(r => ({
      studentId: r.studentId, status: r.status, remarks: r.remarks,
    }));
    if (entries.length === 0) { toast.error('Mark at least one student.'); return; }
    setIsSaving(true);
    try {
      await attendanceApi.mark({ subjectId, date, periodOrder: Number(periodOrder), entries });
      toast.success(`Attendance saved for ${entries.length} student${entries.length !== 1 ? 's' : ''}!`);
      loadRoster();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save attendance');
    } finally { setIsSaving(false); }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Take Attendance</h1>
        <p className="mt-1 text-sm text-slate">Mark period-wise attendance for your subjects</p>
      </div>

      {optionsError && (
        <Card className="border-clay/20 bg-clay-light/60 p-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-clay">{optionsError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => { setOptionsError(''); loadSubjects(); loadPeriods(); }}>Try again</Button>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Date" type="date" value={date}
            onChange={(e) => setDate(e.target.value)} max={todayIso()} />
          <Select label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select subject</option>
            {subjects.map(s => (
              <option key={s._id} value={s._id}>{s.name} — {s.class?.name}</option>
            ))}
          </Select>
          <Select label="Period" value={periodOrder}
            onChange={(e) => setPeriodOrder(e.target.value)}
            disabled={dayPeriods.length === 0}>
            <option value="">{dayPeriods.length === 0 ? 'No periods configured' : 'Select period'}</option>
            {dayPeriods.map(p => <option key={p.order} value={p.order}>{p.name}</option>)}
          </Select>
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {isLoadingRoster ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SkeletonTable cols={2} rows={8} />
          </motion.div>
        ) : rosterError ? (
          <motion.div key="roster-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert">
              <p className="font-semibold text-clay">Roster could not be loaded.</p>
              <p className="mt-1 text-sm text-clay/80">{rosterError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadRoster}>Try again</Button>
            </Card>
          </motion.div>
        ) : !roster ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Users}
              title="Select a subject, date, and period"
              message="The student roster will appear here."
            />
          </motion.div>
        ) : roster.roster.length === 0 ? (
          <motion.div key="no-students" {...fadeUp}>
            <EmptyState title="No students in this class" message="No students are assigned yet." />
          </motion.div>
        ) : (
          <motion.div key="roster" {...fadeUp}>
            <Card className="overflow-hidden">
              {/* Header with live stats */}
              <div className="border-b border-ink/8 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold text-ink">{roster.subject.name}</p>
                    <p className="text-xs text-slate">
                      {roster.periodName} · {format(new Date(date), 'EEEE, MMM d')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl bg-sage-light px-3 py-1.5">
                      <span className="font-display text-base font-bold text-sage">{presentCount}</span>
                      <span className="text-xs text-sage/70">/ {totalCount}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => markAll('present')}>
                    All present
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => markAll('absent')}>
                    All absent
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full bg-ink/5">
                <motion.div
                  className="h-full bg-sage"
                  animate={{ width: `${totalCount > 0 ? (presentCount / totalCount) * 100 : 0}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              {/* Student rows */}
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="divide-y divide-ink/5"
              >
                {roster.roster.map((r, i) => (
                  <motion.div
                    key={r.studentId}
                    variants={staggerItem}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/8 font-display text-xs font-semibold text-ink">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{r.name}</p>
                        <p className="text-xs text-slate">{r.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {STATUS_OPTIONS.map(({ value, label, fullLabel, activeClass }) => (
                        <motion.button
                          key={value}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setStatus(r.studentId, value)}
                          title={fullLabel}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                            r.status === value
                              ? activeClass + ' shadow-sm'
                              : 'bg-ink/5 text-ink/40 hover:bg-ink/10'
                          }`}
                        >
                          {label}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <div className="flex justify-between border-t border-ink/8 px-5 py-4">
                <p className="text-sm text-slate self-center">
                  {roster.roster.filter(r => r.status).length} of {totalCount} marked
                </p>
                <Button icon={Save} onClick={handleSave} isLoading={isSaving}>
                  Save attendance
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
