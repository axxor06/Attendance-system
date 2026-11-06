import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CalendarClock, Lock, RotateCcw, Save, Search, Users } from 'lucide-react';
import clsx from 'clsx';
import { attendanceApi } from '../../api/attendance.js';
import Badge from '../common/Badge.jsx';
import Button from '../common/Button.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Select from '../common/Select.jsx';
import { SkeletonTable } from '../common/Skeleton.jsx';
import StatusToggle from './StatusToggle.jsx';
import { ATTENDANCE_STATUSES } from '../../utils/attendanceStatus.js';
import { getFriendlyError } from '../../utils/errorMessages.js';

const today = () => format(new Date(), 'yyyy-MM-dd');
const FILTERS = [{ value: 'all', label: 'All' }, ...ATTENDANCE_STATUSES.map((s) => ({ value: s.value, label: s.label })), { value: 'unmarked', label: 'Not marked' }];

/**
 * Historical correction flow: date -> class -> session -> find student -> change -> Save correction.
 * Everything shown comes from the stored attendance records; nothing is saved until the faculty
 * presses Save correction, and the server re-checks every id and permission.
 */
export default function CorrectionWorkspace({ initialDate }) {
  const [date, setDate] = useState(initialDate || today());
  const [sessionsState, setSessionsState] = useState({ sessions: [], editable: true, lockedReason: null });
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [classId, setClassId] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [rosterData, setRosterData] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [edits, setEdits] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const sessionsRequest = useRef(0);
  const rosterRequest = useRef(0);

  const loadSessions = useCallback(async () => {
    const id = ++sessionsRequest.current;
    setSessionsLoading(true);
    setSessionsError('');
    try {
      const { data } = await attendanceApi.correctableSessions({ date });
      if (id !== sessionsRequest.current) return;
      setSessionsState(data.data);
    } catch (err) {
      if (id !== sessionsRequest.current) return;
      setSessionsState({ sessions: [], editable: true, lockedReason: null });
      setSessionsError(getFriendlyError(err, 'Sessions for this date could not be loaded.'));
    } finally { if (id === sessionsRequest.current) setSessionsLoading(false); }
  }, [date]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { setClassId(''); setSessionKey(''); setRosterData(null); setEdits({}); setSaved(null); }, [date]);

  const classes = useMemo(() => {
    const map = new Map();
    sessionsState.sessions.forEach((s) => map.set(s.classId, s.className));
    return [...map].map(([id, name]) => ({ id, name }));
  }, [sessionsState.sessions]);

  // A teacher with one class does not need to pick it.
  useEffect(() => { if (!classId && classes.length === 1) setClassId(classes[0].id); }, [classes, classId]);

  const classSessions = useMemo(() => sessionsState.sessions.filter((s) => s.classId === classId), [sessionsState.sessions, classId]);
  const selected = classSessions.find((s) => `${s.subjectId}:${s.periodOrder}` === sessionKey) || null;

  // Depend on the identifying values, not the object: reloading the session list produces a
  // new object for the same session and must not reset what the user is looking at.
  const selectedSubjectId = selected?.subjectId;
  const selectedPeriod = selected?.periodOrder;
  const selectedMarked = selected?.marked;
  const loadRoster = useCallback(async () => {
    if (!selectedSubjectId || !selectedMarked) { setRosterData(null); return; }
    const id = ++rosterRequest.current;
    setRosterLoading(true);
    setRosterError('');
    try {
      const { data } = await attendanceApi.correctionRoster({ subjectId: selectedSubjectId, date, periodOrder: selectedPeriod });
      if (id !== rosterRequest.current) return;
      setRosterData(data.data);
      setEdits({});
    } catch (err) {
      if (id !== rosterRequest.current) return;
      setRosterData(null);
      setRosterError(getFriendlyError(err, 'The attendance for this session could not be loaded.'));
    } finally { if (id === rosterRequest.current) setRosterLoading(false); }
  }, [selectedSubjectId, selectedPeriod, selectedMarked, date]);

  useEffect(() => { loadRoster(); }, [loadRoster]);
  useEffect(() => { setSaved(null); }, [date, sessionKey]);

  const roster = useMemo(() => rosterData?.roster || [], [rosterData]);
  const editable = rosterData ? rosterData.editable : true;
  const statusOf = (row) => edits[row.studentId] ?? row.status;
  const changes = roster.filter((row) => edits[row.studentId] && edits[row.studentId] !== row.status);

  const counts = useMemo(() => {
    const c = { all: roster.length, unmarked: 0 };
    ATTENDANCE_STATUSES.forEach((s) => { c[s.value] = 0; });
    roster.forEach((row) => { const st = edits[row.studentId] ?? row.status; if (st) c[st] += 1; else c.unmarked += 1; });
    return c;
  }, [roster, edits]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roster.filter((row) => {
      const st = edits[row.studentId] ?? row.status;
      if (filter === 'unmarked' ? Boolean(st) : filter !== 'all' && st !== filter) return false;
      return !term || row.name.toLowerCase().includes(term) || (row.registerNumber || '').toLowerCase().includes(term);
    });
  }, [roster, edits, search, filter]);

  function setStatus(row, status) {
    setSaved(null);
    setEdits((current) => {
      const next = { ...current };
      if (status === row.status) delete next[row.studentId]; else next[row.studentId] = status;
      return next;
    });
  }

  async function handleSave() {
    if (!changes.length || isSaving) return;
    setIsSaving(true);
    try {
      const { data } = await attendanceApi.saveCorrections({
        subjectId: selected.subjectId, date, periodOrder: selected.periodOrder,
        reason: reason.trim() || undefined,
        changes: changes.map((row) => ({ studentId: row.studentId, status: edits[row.studentId] })),
      });
      const updated = data?.data?.updated || [];
      setSaved(updated.map((u) => ({ ...u, name: roster.find((r) => r.studentId === u.studentId)?.name || 'Student' })));
      toast.success(`Correction saved for ${updated.length} student${updated.length === 1 ? '' : 's'}.`);
      setReason('');
      await Promise.all([loadRoster(), loadSessions()]);
    } catch (err) {
      toast.error(getFriendlyError(err, 'The correction could not be saved.'));
      if (err?.response?.status === 409) await loadRoster();
    } finally { setIsSaving(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-light">Date
          <input type="date" value={date} max={today()} onChange={(event) => event.target.value && setDate(event.target.value)} className="field" />
        </label>
        <Select label="Class" value={classId} disabled={sessionsLoading || classes.length === 0} onChange={(event) => { setClassId(event.target.value); setSessionKey(''); }}
          hint={sessionsLoading ? 'Loading classes…' : classes.length === 0 && !sessionsError ? 'No classes with sessions on this date.' : undefined}>
          <option value="">Select class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select label="Subject and period" value={sessionKey} disabled={!classId} onChange={(event) => setSessionKey(event.target.value)}>
          <option value="">Select session</option>
          {classSessions.map((s) => (
            <option key={`${s.subjectId}:${s.periodOrder}`} value={`${s.subjectId}:${s.periodOrder}`}>
              {s.periodName} · {s.subjectName}{s.marked ? '' : ' (attendance not taken)'}
            </option>
          ))}
        </Select>
      </div>

      {sessionsError && <div className="notice-error" role="alert"><p className="flex-1 text-sm">{sessionsError}</p><Button type="button" size="sm" variant="outline" onClick={loadSessions}>Try again</Button></div>}
      {sessionsState.editable === false && (
        <div className="notice-caution" role="status"><Lock size={16} aria-hidden="true" /><p className="flex-1 text-sm">{sessionsState.lockedReason}</p></div>
      )}

      {!selected ? (
        <EmptyState icon={CalendarClock} title={sessionsLoading ? 'Loading sessions…' : 'Choose a session to review'} message="Pick the date the class took place, then the class and period. You can correct attendance for any earlier day within your institution's correction window." />
      ) : selected && !selected.marked ? (
        <EmptyState icon={Users} title="Attendance was not taken for this session" message="There are no saved records to correct. Use Take attendance to record this session." />
      ) : rosterLoading ? <SkeletonTable rows={6} cols={4} /> : rosterError ? (
        <div className="notice-error" role="alert"><p className="flex-1 text-sm">{rosterError}</p><Button type="button" size="sm" variant="outline" icon={RotateCcw} onClick={loadRoster}>Try again</Button></div>
      ) : rosterData && (
        <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-label="Session attendance">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-ink">{rosterData.subject.name} <span className="text-slate">· {selected.periodName}</span></h2>
              <p className="text-sm text-slate">{rosterData.class.name} · {format(new Date(`${rosterData.date}T00:00:00`), 'EEEE, d MMMM yyyy')}</p>
            </div>
            <div className="relative lg:w-72">
              <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search students by name or register number" placeholder="Search name or register no." className="field field-sm field-icon" />
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2" role="group" aria-label="Filter by status">
            {FILTERS.map((item) => (
              <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}
                className={clsx('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', filter === item.value ? 'bg-ink text-white' : 'text-slate hover:bg-paper-dim hover:text-ink')}>
                {item.label} <span className="tabular-nums opacity-80">{counts[item.value] ?? 0}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate">{search || filter !== 'all' ? 'No students match your search or filter.' : 'No students on this session.'}</p>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((row) => {
                const changed = edits[row.studentId] && edits[row.studentId] !== row.status;
                return (
                  <li key={row.studentId} className={clsx('flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between', changed && 'bg-amber-light/40')}>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{row.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate">
                        <span className="font-mono">{row.registerNumber || '—'}</span>
                        {row.status ? <Badge variant={row.status}>{row.status}</Badge> : <span>Not marked</span>}
                        {changed && <span className="font-semibold text-ink">will change to {edits[row.studentId]}</span>}
                        {row.correctionCount > 0 && !changed && <span>Corrected {row.correctionCount === 1 ? 'once' : `${row.correctionCount} times`}{row.lastCorrection ? ` · ${format(new Date(row.lastCorrection.at), 'd MMM')}` : ''}</span>}
                      </p>
                    </div>
                    <StatusToggle name={row.name} value={statusOf(row)} onChange={(status) => setStatus(row, status)} disabled={!editable || isSaving} />
                  </li>
                );
              })}
            </ul>
          )}

          {saved && saved.length > 0 && (
            <div className="border-t border-line bg-sage-light/50 px-4 py-3 text-sm" role="status">
              <p className="font-semibold text-ink">Saved. Attendance recalculated:</p>
              <ul className="mt-1 space-y-0.5 text-ink-light">
                {saved.map((u) => <li key={u.studentId}>{u.name}: {u.previousStatus || 'not marked'} → {u.newStatus}{u.overall ? ` · now ${u.overall.percentage}% overall` : ''}</li>)}
              </ul>
            </div>
          )}

          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-surface p-4 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-ink-light">Reason (optional)
              <input value={reason} maxLength={300} disabled={!editable || changes.length === 0} onChange={(event) => setReason(event.target.value)} placeholder="For example, student was present but missed in roll call" className="field field-sm" />
            </label>
            <div className="flex items-center gap-2">
              {changes.length > 0 && <Button type="button" variant="ghost" onClick={() => setEdits({})} disabled={isSaving}>Discard</Button>}
              <Button type="button" icon={Save} onClick={handleSave} isLoading={isSaving} disabled={!editable || changes.length === 0}>
                {changes.length ? `Save correction (${changes.length})` : 'Save correction'}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
