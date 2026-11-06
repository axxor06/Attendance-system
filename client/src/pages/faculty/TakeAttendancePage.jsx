import { getFriendlyError } from '../../utils/errorMessages.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { formatCalendarDate } from '../../utils/calendarDate.js';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Save, Users } from 'lucide-react';
import { subjectApi } from '../../api/academicsExtra.js';
import { periodApi } from '../../api/academicsExtra.js';
import { attendanceApi } from '../../api/attendance.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';
import Input from '../../components/common/Input.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { requestSingleFlight } from '../../utils/requestSingleFlight.js';
import { filterFacultyPeriods } from '../../utils/facultyPeriodScope.js';

const STATUS_OPTIONS = [
  { value: 'present', label: 'P', fullLabel: 'Present', activeClass: 'bg-sage text-white' },
  { value: 'absent',  label: 'A', fullLabel: 'Absent',  activeClass: 'bg-clay text-white' },
  { value: 'late',    label: 'L', fullLabel: 'Late',    activeClass: 'bg-amber text-ink' },
  { value: 'excused', label: 'E', fullLabel: 'Excused', activeClass: 'bg-slate text-white' },
];

function todayIso() { return format(new Date(), 'yyyy-MM-dd'); }
function getDayName(dateStr) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return days[new Date(dateStr).getUTCDay()];
}
function cleanId(value) {
  const candidate = typeof value === 'object' ? value?._id ?? value?.id : value;
  const normalized = candidate == null ? '' : String(candidate);
  return /^[0-9a-f]{24}$/i.test(normalized) ? normalized : '';
}

export default function TakeAttendancePage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [dayPeriods, setDayPeriods] = useState([]);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [rosterError, setRosterError] = useState('');
  const [date, setDate] = useState(todayIso());
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') || '');
  const [periodOrder, setPeriodOrder] = useState(searchParams.get('periodOrder') || '');
  const [roster, setRoster] = useState(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const periodsRequestRef = useRef(0);
  const rosterRequestRef = useRef(0);

  const loadSubjects = useCallback(async () => {
    try {
      const { data } = await requestSingleFlight(`faculty-subjects:${cleanId(user?._id)}`, () => subjectApi.mySubjects());
      const nextSubjects = data?.data?.subjects || [];
      setSubjects(nextSubjects);
      setSubjectId((current) => nextSubjects.some((subject) => cleanId(subject._id) === cleanId(current)) ? current : nextSubjects[0]?._id || '');
    } catch (err) {
      setSubjects([]);
      setOptionsError(getFriendlyError(err, 'Could not load subjects.'));
    }
  }, [user?._id]);

  const loadPeriods = useCallback(async () => {
    const requestId = ++periodsRequestRef.current;
    const selectedSubject = subjects.find((subject) => cleanId(subject._id) === cleanId(subjectId));
    const classId = selectedSubject?.class?._id || selectedSubject?.class;
    if (!date || !subjectId || !classId) {
      setDayPeriods([]);
      setPeriodOrder('');
      setIsLoadingPeriods(false);
      return;
    }
    setIsLoadingPeriods(true);
    try {
      const { data } = await requestSingleFlight(
        `faculty-periods:${cleanId(user?._id)}:${classId}:${getDayName(date)}:${cleanId(subjectId)}`,
        () => periodApi.getByDay(getDayName(date), { classId, subjectId }),
      );
      if (requestId !== periodsRequestRef.current) return;
      const source = data?.data?.source;
      const periods = data?.data?.template?.periods || [];
      const matchingPeriods = filterFacultyPeriods(periods, { source, subjectId, facultyId: user?._id });
      setDayPeriods(matchingPeriods);
      setPeriodOrder((current) => matchingPeriods.some((period) => String(period.order) === String(current)) ? current : '');
    } catch (err) {
      if (requestId !== periodsRequestRef.current) return;
      setDayPeriods([]);
      setPeriodOrder('');
      setOptionsError(getFriendlyError(err, 'Could not load periods for this subject.'));
    } finally {
      if (requestId === periodsRequestRef.current) setIsLoadingPeriods(false);
    }
  }, [date, subjectId, subjects, user?._id]);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);
  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const loadRoster = useCallback(async () => {
    const requestId = ++rosterRequestRef.current;
    const selectedPeriod = dayPeriods.find((period) => String(period.order) === String(periodOrder));
    if (!subjectId || !date || !periodOrder || !selectedPeriod) {
      setIsLoadingRoster(false);
      setRoster(null);
      return;
    }
    setIsLoadingRoster(true); setRoster(null); setRosterError('');
    try {
      const { data } = await requestSingleFlight(
        `faculty-roster:${cleanId(user?._id)}:${cleanId(subjectId)}:${date}:${Number(periodOrder)}`,
        () => attendanceApi.sessionRoster({ subjectId, date, periodOrder: Number(periodOrder) }),
      );
      if (requestId !== rosterRequestRef.current) return;
      setRoster(data.data);
    } catch (err) {
      if (requestId !== rosterRequestRef.current) return;
      const message = getFriendlyError(err, 'Could not load roster');
      setRosterError(message);
      toast.error(message);
    } finally {
      if (requestId === rosterRequestRef.current) setIsLoadingRoster(false);
    }
  }, [dayPeriods, subjectId, date, periodOrder, user?._id]);

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
      toast.error(getFriendlyError(err, 'Could not save attendance'));
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
            onChange={(e) => { setDate(e.target.value); setPeriodOrder(''); setRoster(null); setRosterError(''); }} max={todayIso()} />
          <Select label="Subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPeriodOrder(''); setRoster(null); setRosterError(''); }}>
            <option value="">Select subject</option>
            {subjects.map(s => (
              <option key={s._id} value={s._id}>{s.name} — {s.class?.name}</option>
            ))}
          </Select>
          <Select label="Period" value={periodOrder}
            onChange={(e) => setPeriodOrder(e.target.value)}
            disabled={isLoadingPeriods || dayPeriods.length === 0}>
            <option value="">{isLoadingPeriods ? 'Loading matching periods…' : dayPeriods.length === 0 ? 'No periods for this subject' : 'Select period'}</option>
            {dayPeriods.map(p => <option key={p.order} value={p.order}>{p.name}{p.startTime && p.endTime ? ` · ${p.startTime}–${p.endTime}` : ''}</option>)}
          </Select>
        </div>
      </Card>

      <AnimatePresence>
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
                      {roster.periodName} · {formatCalendarDate(date, 'EEEE, MMM d')}
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
              <div className="h-1 w-full bg-indigo/5">
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
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo/8 font-display text-xs font-semibold text-ink">
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
                              : 'bg-indigo/5 text-ink/40 hover:bg-indigo/10'
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
