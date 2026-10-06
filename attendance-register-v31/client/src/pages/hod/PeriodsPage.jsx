import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Check, ChevronDown, Coffee, GraduationCap, Plus, Save, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { departmentApi, classApi } from '../../api/academics.js';
import { subjectApi } from '../../api/academicsExtra.js';
import { timetableApi } from '../../api/workflows.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { canonicalRole } from '../../components/layout/navigation.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { fadeUp } from '../../utils/motion.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABEL = Object.fromEntries(DAYS.map((day) => [day, day[0].toUpperCase() + day.slice(1)]));

function newSlot(order) {
  return { order, name: `Period ${order}`, kind: 'class', startTime: '', endTime: '', subject: '', faculty: '', note: '' };
}

function cleanId(value) {
  if (value === null || value === undefined || value === '') return '';
  const candidate = typeof value === 'object' ? value._id ?? value.id : value;
  if (candidate === null || candidate === undefined || candidate === '') return '';
  const normalized = typeof candidate === 'string' ? candidate : candidate?.toString?.();
  return /^[0-9a-f]{24}$/i.test(normalized || '') ? normalized : '';
}

function normalizeTimetable(value) {
  if (!value) return null;
  return {
    ...value,
    _id: cleanId(value),
    days: (value.days || []).map((day) => ({
      ...day,
      slots: (day.slots || []).map((slot) => ({ ...slot, _id: cleanId(slot) })),
    })),
  };
}

function getAvailabilityState(states, order) {
  return states[String(order)] || { status: 'loading', faculty: [], error: '', eligibleFacultyCount: null, busyFacultyCount: null, availableFacultyCount: null };
}

function getAvailabilityLabel(state) {
  if (state.status === 'idle') return 'Select subject first';
  if (state.status === 'error') return 'Availability unavailable';
  if (state.status === 'empty') return 'No Faculty available for this period';
  if (state.status === 'success') return 'Select available Faculty';
  return 'Checking availability…';
}

function hasTimetableConflict(details, dayOfWeek, slot) {
  return (details || []).some((detail) => {
    if (detail.dayOfWeek !== dayOfWeek || String(detail.facultyId || '') !== String(cleanId(slot.faculty) || '')) return false;
    if (detail.currentSlotId && slot._id) return String(detail.currentSlotId) === String(slot._id);
    return Number(detail.order) === Number(slot.order)
      && (detail.currentStartTime || null) === (slot.startTime || null)
      && (detail.currentEndTime || null) === (slot.endTime || null);
  });
}

function getAvailabilityHelper(state) {
  if (state.error) return `${state.error} Try again before assigning Faculty.`;
  if (state.status === 'idle') return 'Select a subject to check Faculty availability for this period.';
  if (state.status === 'loading') return 'Checking live Faculty availability…';
  if (state.status === 'empty') {
    const eligible = Number.isInteger(state.eligibleFacultyCount) ? `All ${state.eligibleFacultyCount} eligible Faculty are already assigned during this period.` : 'No active Faculty is available for this exact slot.';
    return `${eligible} Choose another period or subject.`;
  }
  const count = Number.isInteger(state.availableFacultyCount) ? state.availableFacultyCount : state.faculty.length;
  return `${count} Faculty available. Busy Faculty members are hidden and availability is rechecked when saved.`;
}

export default function PeriodsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [expandedDepartments, setExpandedDepartments] = useState({});
  const [timetable, setTimetable] = useState(null);
  const [activeDay, setActiveDay] = useState('monday');
  const [draft, setDraft] = useState([]);
  const [availabilityByOrder, setAvailabilityByOrder] = useState({});
  const availabilityRequestId = useRef(0);
  const classLoadRequestId = useRef(0);
  const [classLoadNonce, setClassLoadNonce] = useState(0);
  const [conflictDetails, setConflictDetails] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClassLoading, setIsClassLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedClass = classes.find((item) => item._id === selectedClassId);
  const departmentGroups = useMemo(() => departments.map((department) => ({
    department,
    classes: classes.filter((item) => cleanId(item.department) === department._id),
  })).filter((group) => group.classes.length > 0), [classes, departments]);

  const loadDirectory = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [departmentResult, classResult] = await Promise.all([
        departmentApi.list(),
        classApi.list({ limit: 100 }),
      ]);
      const nextDepartments = departmentResult.data?.data?.departments || [];
      const nextClasses = classResult.data?.data?.classes || [];
      setDepartments(nextDepartments);
      setClasses(nextClasses);
      setSelectedClassId((current) => current || nextClasses[0]?._id || '');
      setExpandedDepartments(Object.fromEntries(nextDepartments.map((department, index) => [department._id, index === 0])));
    } catch (err) {
      setError(getFriendlyError(err, 'The academic timetable directory could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);
  useEffect(() => {
    const requestId = ++classLoadRequestId.current;
    const controller = new AbortController();
    const isCurrentRequest = () => requestId === classLoadRequestId.current;

    setIsClassLoading(Boolean(selectedClassId));
    setError('');
    setTimetable(null);
    setSubjects([]);
    setDraft([]);
    setAvailabilityByOrder({});
    setConflictDetails([]);
    if (!selectedClassId) {
      setIsClassLoading(false);
      return () => controller.abort();
    }

    async function loadClassWorkspace() {
      try {
        const [timetableResult, subjectResult] = await Promise.all([
          timetableApi.get(selectedClassId, { signal: controller.signal }),
          subjectApi.list({ classId: selectedClassId, limit: 100 }, { signal: controller.signal }),
        ]);
        if (!isCurrentRequest()) return;
        const nextTimetable = normalizeTimetable(timetableResult.data?.data?.timetable || null);
        setTimetable(nextTimetable);
        setSubjects(subjectResult.data?.data?.subjects || []);
        setActiveDay('monday');
      } catch (err) {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || !isCurrentRequest()) return;
        setTimetable(null);
        setSubjects([]);
        setError(getFriendlyError(err, 'This class timetable could not be loaded.'));
      } finally {
        if (isCurrentRequest()) setIsClassLoading(false);
      }
    }

    loadClassWorkspace();
    return () => controller.abort();
  }, [selectedClassId, classLoadNonce]);
  useEffect(() => {
    const day = timetable?.days?.find((entry) => entry.dayOfWeek === activeDay);
    setDraft((day?.slots || []).map((slot) => ({
      ...slot,
      subject: cleanId(slot.subject),
      faculty: cleanId(slot.faculty),
      startTime: slot.startTime || '',
      endTime: slot.endTime || '',
      note: slot.note || '',
    })).sort((left, right) => left.order - right.order));
  }, [activeDay, timetable]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++availabilityRequestId.current;
    const controller = new AbortController();
    const classSlots = draft.filter((slot) => slot.kind === 'class');
    const requestableSlots = classSlots.filter((slot) => Boolean(cleanId(slot.subject)));
    const isCurrentRequest = () => !cancelled && requestId === availabilityRequestId.current;

    if (!selectedClassId || canonicalRole(user?.role) !== 'super_admin' || !classSlots.length) {
      setAvailabilityByOrder({});
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const loadingStates = Object.fromEntries(classSlots.map((slot) => [String(slot.order), { status: cleanId(slot.subject) ? 'loading' : 'idle', faculty: [], error: '', eligibleFacultyCount: null, busyFacultyCount: null, availableFacultyCount: null }]));
    if (!requestableSlots.length) {
      setAvailabilityByOrder(loadingStates);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }
    setAvailabilityByOrder(loadingStates);

    async function loadAvailability() {
      try {
        const results = await Promise.all(requestableSlots.map(async (slot) => {
          try {
            const { data } = await timetableApi.availability({
              classId: selectedClassId,
              subjectId: cleanId(slot.subject) || undefined,
              dayOfWeek: activeDay,
              order: slot.order,
              startTime: slot.startTime || undefined,
              endTime: slot.endTime || undefined,
              excludeTimetableId: cleanId(timetable) || undefined,
              slotId: cleanId(slot) || undefined,
            }, { signal: controller.signal });
            const faculty = Array.isArray(data?.data?.faculty) ? data.data.faculty : [];
            const eligibleFacultyCount = Number.isInteger(data?.data?.eligibleFacultyCount) ? data.data.eligibleFacultyCount : faculty.length;
            const busyFacultyCount = Number.isInteger(data?.data?.busyFacultyCount) ? data.data.busyFacultyCount : Math.max(0, eligibleFacultyCount - faculty.length);
            const availableFacultyCount = Number.isInteger(data?.data?.availableFacultyCount) ? data.data.availableFacultyCount : faculty.length;
            return { order: String(slot.order), status: faculty.length ? 'success' : 'empty', faculty, error: '', eligibleFacultyCount, busyFacultyCount, availableFacultyCount };
          } catch (err) {
            if (controller.signal.aborted || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
              return { order: String(slot.order), status: controller.signal.aborted ? 'cancelled' : 'error', faculty: [], error: controller.signal.aborted ? '' : 'Availability check was cancelled. Please try again.', eligibleFacultyCount: null, busyFacultyCount: null, availableFacultyCount: null };
            }
            return { order: String(slot.order), status: 'error', faculty: [], error: getFriendlyError(err, 'Unable to check Faculty availability. Please try again.'), eligibleFacultyCount: null, busyFacultyCount: null, availableFacultyCount: null };
          }
        }));
        if (isCurrentRequest()) setAvailabilityByOrder({ ...loadingStates, ...Object.fromEntries(results.map((result) => [result.order, result])) });
      } catch (err) {
        if (isCurrentRequest()) {
          const message = getFriendlyError(err, 'Unable to check Faculty availability. Please try again.');
          setAvailabilityByOrder({ ...loadingStates, ...Object.fromEntries(requestableSlots.map((slot) => [String(slot.order), { status: 'error', faculty: [], error: message, eligibleFacultyCount: null, busyFacultyCount: null, availableFacultyCount: null }])) });
        }
      } finally {
        if (isCurrentRequest()) {
          setAvailabilityByOrder((current) => Object.fromEntries(Object.entries(current).map(([order, state]) => [order, state.status === 'loading' ? { ...state, status: 'error', faculty: [], error: 'Unable to check Faculty availability. Please try again.' } : state])));
        }
      }
    }

    loadAvailability();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeDay, draft, selectedClassId, timetable, user?.role]);

  function toggleDepartment(departmentId) {
    setExpandedDepartments((current) => ({ ...current, [departmentId]: !current[departmentId] }));
  }

  function updateSlot(index, field, value) {
    setDraft((current) => current.map((slot, slotIndex) => {
      if (slotIndex !== index) return slot;
      if (field === 'kind' && value === 'break') return { ...slot, kind: value, subject: '', faculty: '' };
      return { ...slot, [field]: value };
    }));
  }

  function addSlot() {
    const nextOrder = draft.length ? Math.max(...draft.map((slot) => Number(slot.order))) + 1 : 1;
    if (nextOrder > 24) return;
    setDraft((current) => [...current, newSlot(nextOrder)]);
  }

  function removeSlot(index) {
    setDraft((current) => current.filter((_, slotIndex) => slotIndex !== index).map((slot, slotIndex) => ({ ...slot, order: slotIndex + 1 })));
  }

  async function saveTimetable() {
    if (!selectedClassId) return;
    setIsSaving(true);
    setError('');
    setConflictDetails([]);
    try {
      const existingDays = timetable?.days || [];
      const days = DAYS.map((day) => ({
        dayOfWeek: day,
        slots: (day === activeDay ? draft : existingDays.find((entry) => entry.dayOfWeek === day)?.slots || []).map((slot, index) => ({
          ...(cleanId(slot) ? { _id: cleanId(slot) } : {}),
          order: Number(slot.order || index + 1),
          name: String(slot.name || `Period ${index + 1}`).trim(),
          kind: slot.kind || 'class',
          startTime: slot.startTime || null,
          endTime: slot.endTime || null,
          subject: slot.kind === 'class' ? cleanId(slot.subject) || null : null,
          faculty: slot.kind === 'class' ? cleanId(slot.faculty) || null : null,
          note: slot.note?.trim() || null,
        })),
      }));
      const { data } = await timetableApi.save(selectedClassId, { days });
      setTimetable(normalizeTimetable(data?.data?.timetable || null));
      setConflictDetails([]);
      toast.success('Class timetable saved securely.');
    } catch (err) {
      const details = err.response?.data?.details;
      const message = getFriendlyError(err, 'The timetable could not be saved. Check Faculty availability and slot assignments.');
      setConflictDetails(Array.isArray(details) ? details : []);
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }


  if (isLoading) return <SkeletonCard />;

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6"><div><p className="eyebrow">Institution scheduling</p><h1 className="page-title mt-2">Class timetables</h1><p className="page-lede mt-2 max-w-3xl">Open a department, choose a semester class, and build its weekly schedule. Faculty availability is checked against every other class before saving.</p></div><div className="flex items-center gap-2 rounded-full border border-sage/25 bg-sage-light/60 px-3 py-1.5 text-xs font-semibold text-sage"><Check size={14} />Server-validated schedule</div></header>
      {error && <div className="notice-error" role="alert"><div className="min-w-0 flex-1"><p>{error}</p>{conflictDetails.length > 0 && <ul className="mt-2 space-y-1 text-xs leading-5 text-clay/90">{conflictDetails.slice(0, 6).map((detail, index) => <li key={`${detail.facultyId}-${detail.dayOfWeek}-${detail.order}-${index}`}><strong>{detail.facultyName || 'Faculty member'}</strong> · {String(detail.dayOfWeek || '').replace(/^./, (letter) => letter.toUpperCase())}, Period {detail.order}{detail.startTime && detail.endTime ? ` (${detail.startTime}–${detail.endTime})` : ''}{detail.conflictingClassName ? ` · Conflicts with ${detail.conflictingClassName}` : ''}</li>)}</ul>}</div><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => {               setError(''); setConflictDetails([]); setClassLoadNonce((current) => current + 1); loadDirectory(); }}>Try again</Button></div>}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(220px,0.34fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden p-0"><div className="border-b border-line px-5 py-4"><p className="eyebrow">Academic structure</p><h2 className="mt-1 font-display text-lg font-semibold text-ink">Departments & semesters</h2></div><div className="max-h-[70vh] overflow-y-auto p-3">{departmentGroups.length === 0 ? <EmptyState icon={GraduationCap} title="No classes yet" message="Create a department-semester class before building a timetable." /> : departmentGroups.map(({ department, classes: groupClasses }) => <div key={department._id} className="mb-2 overflow-hidden rounded-xl border border-line"><button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-surface" onClick={() => toggleDepartment(department._id)} aria-expanded={Boolean(expandedDepartments[department._id])}><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{department.name}</span><span className="mt-0.5 block text-xs text-slate">{department.code} · {groupClasses.length} classes</span></span><ChevronDown size={16} className={`shrink-0 text-slate transition-transform ${expandedDepartments[department._id] ? 'rotate-180' : ''}`} /></button>{expandedDepartments[department._id] && <div className="border-t border-line bg-surface/60 p-2">{groupClasses.map((classItem) => <button key={classItem._id} type="button" onClick={() => setSelectedClassId(classItem._id)} className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left last:mb-0 ${selectedClassId === classItem._id ? 'bg-ink text-paper' : 'text-ink hover:bg-paper'}`}><CalendarClock size={15} className="shrink-0" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{classItem.semester?.label || classItem.name}</span><span className={`mt-0.5 block text-xs ${selectedClassId === classItem._id ? 'text-paper/65' : 'text-slate'}`}>{classItem.code}</span></span></button>)}</div>}</div>)}</div></Card>
        <section className="min-w-0">{!selectedClass ? <Card className="p-8"><EmptyState icon={CalendarClock} title="Choose a class" message="Select a department and semester to begin." /></Card> : isClassLoading ? <SkeletonCard /> : <div className="flex flex-col gap-5"><Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="eyebrow">{selectedClass.department?.name || 'Department'} · {selectedClass.semester?.label || selectedClass.name}</p><h2 className="mt-1 font-display text-2xl font-semibold text-ink">{selectedClass.name}</h2><p className="mt-1 text-sm text-slate">One schedule for this class. Subjects and Faculty remain explicit per period.</p></div><div className="rounded-xl border border-line bg-surface px-4 py-3"><p className="eyebrow">Class tutor</p><p className="mt-1 text-sm font-semibold text-ink">{selectedClass.classTeacher?.name || 'No tutor assigned'}</p><p className="mt-1 text-xs leading-5 text-slate">Manage the stable tutor assignment in Academic Management.</p></div></div></Card>          <Card className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Weekly timetable</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display text-lg font-semibold text-ink">{DAY_LABEL[activeDay]}</h3>
                  <span className="text-xs font-medium text-slate">{draft.length} {draft.length === 1 ? 'slot' : 'slots'} in this day</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" icon={Plus} onClick={addSlot} disabled={draft.length >= 24}>Add slot</Button>
                <Button type="button" size="sm" icon={Save} onClick={saveTimetable} isLoading={isSaving}>Save timetable</Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 overflow-x-auto border-b border-line pb-4 sm:flex sm:flex-wrap sm:gap-2" aria-label="Timetable days">
              {DAYS.map((day) => {
                const slotCount = timetable?.days?.find((entry) => entry.dayOfWeek === day)?.slots?.length || 0;
                return <button key={day} type="button" onClick={() => setActiveDay(day)} className={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition-colors sm:min-w-[92px] ${activeDay === day ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line bg-paper text-slate hover:border-ink/30 hover:bg-surface hover:text-ink'}`} aria-pressed={activeDay === day}><span className="block text-xs font-semibold">{DAY_LABEL[day]}</span><span className={`mt-0.5 block text-[11px] ${activeDay === day ? 'text-paper/65' : 'text-slate/75'}`}>{slotCount} {slotCount === 1 ? 'slot' : 'slots'}</span></button>;
              })}
            </div>

            {draft.length === 0 ? <div className="py-8"><EmptyState icon={CalendarClock} title={`No ${DAY_LABEL[activeDay]} slots`} message="Add a class period or break to build this day." action={<Button type="button" icon={Plus} onClick={addSlot}>Add first slot</Button>} /></div> : <div className="mt-5 space-y-4">
              {draft.map((slot, index) => {
                const slotHasConflict = hasTimetableConflict(conflictDetails, activeDay, slot);
                const availability = getAvailabilityState(availabilityByOrder, slot.order);
                return <div key={`${activeDay}-${slot.order}`} className={`rounded-2xl border bg-paper p-4 shadow-[0_4px_16px_rgba(33,45,61,0.04)] sm:p-5 ${slotHasConflict ? 'border-clay ring-1 ring-clay/30' : 'border-line'}`} data-conflict={slotHasConflict ? 'true' : undefined}>
                  <div className="grid gap-5 xl:grid-cols-[minmax(190px,0.42fr)_minmax(0,1.58fr)] xl:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-paper">{slot.order}</div>
                      <div className="min-w-0 flex-1">
                        <p className="eyebrow">Slot {slot.order}</p>
                        <input id={`slot-name-${slot.order}`} value={slot.name} onChange={(event) => updateSlot(index, 'name', event.target.value)} className="field mt-1 w-full" maxLength={120} aria-label={`Name for slot ${slot.order}`} />
                        {slotHasConflict && <span className="mt-2 inline-flex rounded-full bg-clay-light px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-clay">Conflict needs review</span>}
                      </div>
                      <button type="button" onClick={() => removeSlot(index)} aria-label={`Remove ${slot.name || `slot ${slot.order}`}`} className="icon-button shrink-0 text-slate hover:bg-clay-light hover:text-clay"><Trash2 size={16} /></button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="field-label" htmlFor={`slot-kind-${slot.order}`}>Period type</label>
                        <Select id={`slot-kind-${slot.order}`} value={slot.kind} onChange={(event) => updateSlot(index, 'kind', event.target.value)} className="mt-1"><option value="class">Class period</option><option value="break">Break / free period</option></Select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`slot-subject-${slot.order}`}>Subject</label>
                        <Select id={`slot-subject-${slot.order}`} value={slot.subject} onChange={(event) => updateSlot(index, 'subject', event.target.value)} disabled={slot.kind === 'break'} className="mt-1"><option value="">Select subject</option>{subjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name} · {subject.code}</option>)}</Select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`slot-faculty-${slot.order}`}>Assigned Faculty</label>
                        <Select id={`slot-faculty-${slot.order}`} value={slot.faculty} onChange={(event) => updateSlot(index, 'faculty', event.target.value)} disabled={slot.kind === 'break' || availability.status !== 'success'} className="mt-1"><option value="">{slot.kind === 'break' ? 'Not applicable' : getAvailabilityLabel(availability)}</option>{availability.faculty.map((member) => <option key={member._id} value={member._id}>{member.name}{member.employeeId ? ` · ${member.employeeId}` : ''}</option>)}</Select>
                        <p className={`mt-1.5 text-[11px] leading-4 ${availability.error ? 'text-clay' : 'text-slate'}`} role={availability.error ? 'alert' : undefined}>{getAvailabilityHelper(availability)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="field-label" htmlFor={`slot-start-${slot.order}`}>Starts</label>
                          <input id={`slot-start-${slot.order}`} type="time" value={slot.startTime} onChange={(event) => updateSlot(index, 'startTime', event.target.value)} className="field mt-1" />
                        </div>
                        <div>
                          <label className="field-label" htmlFor={`slot-end-${slot.order}`}>Ends</label>
                          <input id={`slot-end-${slot.order}`} type="time" value={slot.endTime} onChange={(event) => updateSlot(index, 'endTime', event.target.value)} className="field mt-1" />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="field-label" htmlFor={`slot-note-${slot.order}`}>Note <span className="font-normal normal-case tracking-normal text-slate/70">(optional)</span></label>
                        <input id={`slot-note-${slot.order}`} value={slot.note} onChange={(event) => updateSlot(index, 'note', event.target.value)} className="field mt-1" maxLength={240} placeholder={slot.kind === 'break' ? 'Lunch, assembly, lab changeover…' : 'Optional room or delivery note'} />
                      </div>
                    </div>
                  </div>
                  {slot.kind === 'break' && <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-xs font-medium leading-5 text-amber"><Coffee size={13} className="mt-0.5 shrink-0" />Break periods cannot receive attendance or Faculty assignments.</p>}
                </div>;
              })}
            </div>}
          </Card></div>}</section>
      </div>
    </motion.div>
  );
}
