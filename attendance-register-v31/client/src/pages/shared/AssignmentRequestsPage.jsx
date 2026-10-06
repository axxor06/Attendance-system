import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Check, ClipboardList, RefreshCw, Send, X } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import { assignmentRequestApi, timetableApi } from '../../api/workflows.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { fadeUp } from '../../utils/motion.js';

const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function statusClass(status) {
  if (status === 'accepted') return 'border-sage/25 bg-sage-light/60 text-sage';
  if (status === 'rejected') return 'border-clay/25 bg-clay-light/60 text-clay';
  return 'border-amber/25 bg-amber-light/50 text-amber';
}

function StatusPill({ status }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(status)}`}>{status}</span>;
}

function requestSlot(request) {
  const day = request?.timetable?.days?.find((entry) => entry.dayOfWeek === request.dayOfWeek);
  return day?.slots?.find((slot) => String(slot._id) === String(request.slotId)) || {};
}

function slotLabel(slot) {
  if (slot.startTime && slot.endTime) return `${slot.startTime}–${slot.endTime}`;
  return `Period ${slot.order}`;
}

function FacultyRequestPage() {
  const { user } = useAuth();
  const [timetables, setTimetables] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [timetableResponse, requestResponse] = await Promise.all([
        timetableApi.list(),
        assignmentRequestApi.list(),
      ]);
      setTimetables(timetableResponse.data?.data?.timetables || []);
      setRequests(requestResponse.data?.data?.requests || []);
    } catch (error) {
      setTimetables([]);
      setRequests([]);
      setLoadError(getFriendlyError(error, 'Assignment requests could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const assignedSlots = useMemo(() => {
    const facultyId = String(user?._id || user?.id || '');
    return timetables.flatMap((timetable) => (timetable.days || []).flatMap((day) => (day.slots || [])
      .filter((slot) => slot.kind === 'class' && String(slot.faculty?._id || slot.faculty) === facultyId)
      .map((slot) => ({ ...slot, timetableId: timetable._id, class: timetable.class, dayOfWeek: day.dayOfWeek }))));
  }, [timetables, user?._id, user?.id]);

  function pendingForSlot(slot) {
    return requests.find((request) => request.status === 'pending' && String(request.timetable?._id || request.timetable) === String(slot.timetableId) && String(request.slotId) === String(slot._id));
  }

  function openRequest(slot) {
    setSelectedSlot(slot);
    setReason('');
  }

  async function submitRequest() {
    if (!selectedSlot || reason.trim().length < 5) return;
    setIsSubmitting(true);
    try {
      const { data } = await assignmentRequestApi.create({
        timetableId: selectedSlot.timetableId,
        dayOfWeek: selectedSlot.dayOfWeek,
        slotId: selectedSlot._id,
        reason: reason.trim(),
      });
      setRequests((current) => [data?.data?.request, ...current].filter(Boolean));
      setSelectedSlot(null);
      setReason('');
      toast.success('Inability request sent to the HOD.');
    } catch (error) {
      toast.error(getFriendlyError(error, 'The inability request could not be sent.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div><p className="eyebrow">Teaching operations</p><h1 className="page-title mt-2">Assignment requests</h1><p className="page-lede mt-2 max-w-2xl">Report an inability only for a timetable slot currently assigned to you. The HOD will review the reason and, if accepted, appoint a Faculty member who is free at that exact time.</p></div>
        <Button type="button" variant="outline" size="sm" icon={RefreshCw} onClick={loadData} disabled={isLoading}>Refresh</Button>
      </header>
      {loadError && <div className="notice-error" role="alert"><p>{loadError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadData}>Try again</Button></div>}
      {isLoading ? <SkeletonCard /> : assignedSlots.length === 0 ? <EmptyState icon={ClipboardList} title="No assigned timetable slots" message="Your active class periods will appear here once the HOD publishes the class timetable." /> : <div className="grid gap-4 lg:grid-cols-2">{assignedSlots.map((slot) => {
        const pending = pendingForSlot(slot);
        return <Card key={`${slot.timetableId}-${slot._id}`} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{DAY_LABELS[slot.dayOfWeek]} · {slotLabel(slot)}</p><h2 className="mt-1 text-lg font-semibold text-ink">{slot.subject?.name || 'Assigned subject'}</h2><p className="mt-1 text-sm text-slate">{slot.class?.name || 'Class'}{slot.class?.code ? ` · ${slot.class.code}` : ''}</p></div>{pending ? <StatusPill status={pending.status} /> : <span className="rounded-full border border-sage/25 bg-sage-light/60 px-2.5 py-1 text-xs font-semibold text-sage">Current assignment</span>}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">{pending ? <p className="text-sm text-slate">Submitted {pending.createdAt ? format(new Date(pending.createdAt), 'dd MMM yyyy') : 'recently'}; waiting for HOD review.</p> : <p className="text-sm text-slate">Cannot take this slot?</p>} {!pending && <Button type="button" variant="outline" size="sm" icon={AlertTriangle} onClick={() => openRequest(slot)}>Report inability</Button>}</div></Card>;
      })}</div>}
      {requests.length > 0 && <Card className="p-5"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Request history</p><h2 className="mt-1 text-lg font-semibold text-ink">Your submitted requests</h2></div><span className="text-sm text-slate">{requests.length} total</span></div><div className="mt-4 flex flex-col divide-y divide-line">{requests.slice(0, 8).map((request) => <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-semibold text-ink">{request.subject?.name || 'Assigned subject'} · {DAY_LABELS[request.dayOfWeek] || request.dayOfWeek} · Period {request.order}</p><p className="mt-1 truncate text-xs text-slate">{request.reason}</p>{request.decisionReason && <p className="mt-1 text-xs text-clay">HOD note: {request.decisionReason}</p>}</div><StatusPill status={request.status} /></div>)}</div></Card>}
      {selectedSlot && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/35 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="assignment-request-title"><Card className="w-full max-w-lg p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{DAY_LABELS[selectedSlot.dayOfWeek]} · {slotLabel(selectedSlot)}</p><h2 id="assignment-request-title" className="mt-1 text-xl font-semibold text-ink">Why can’t you take this slot?</h2></div><button type="button" className="icon-button" onClick={() => setSelectedSlot(null)} aria-label="Close assignment request"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-slate">The reason is shared with the authorized HOD so they can decide whether a replacement is needed.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} className="field mt-4 min-h-32 resize-y" placeholder="Describe the scheduling conflict or other inability (at least 5 characters)." aria-label="Inability reason" /><div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setSelectedSlot(null)} disabled={isSubmitting}>Cancel</Button><Button type="button" icon={Send} onClick={submitRequest} isLoading={isSubmitting} disabled={reason.trim().length < 5}>Send to HOD</Button></div></Card></div>}
    </motion.div>
  );
}

function HodRequestPage() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [replacementFaculty, setReplacementFaculty] = useState('');
  const [availableFaculty, setAvailableFaculty] = useState([]);
  const [availabilityError, setAvailabilityError] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await assignmentRequestApi.list();
      setRequests(data?.data?.requests || []);
    } catch (error) {
      setRequests([]);
      setLoadError(getFriendlyError(error, 'Assignment requests could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function beginDecision(request) {
    setDecisionTarget(request);
    setReplacementFaculty('');
    setDecisionReason('');
    setAvailableFaculty([]);
    setAvailabilityError('');
    if (request.status !== 'pending') return;
    const slot = requestSlot(request);
    setIsLoadingAvailability(true);
    try {
      const { data } = await timetableApi.availability({
        classId: request.class?._id || request.class,
        dayOfWeek: request.dayOfWeek,
        order: request.order,
        startTime: slot.startTime || undefined,
        endTime: slot.endTime || undefined,
        excludeTimetableId: request.timetable?._id || request.timetable,
      });
      setAvailableFaculty(data?.data?.faculty || []);
    } catch (error) {
      setAvailableFaculty([]);
      const message = getFriendlyError(error, 'Faculty availability could not be checked. Try again before choosing a replacement.');
      setAvailabilityError(message);
      toast.error(message);
    } finally {
      setIsLoadingAvailability(false);
    }
  }

  async function confirmDecision(status) {
    if (!decisionTarget) return;
    if (status === 'accepted' && !replacementFaculty) return;
    if (status === 'rejected' && decisionReason.trim().length < 5) return;
    setIsDeciding(true);
    try {
      const payload = status === 'accepted' ? { status, replacementFaculty } : { status, decisionReason: decisionReason.trim() };
      const { data } = await assignmentRequestApi.decide(decisionTarget._id, payload);
      const updated = data?.data?.request;
      setRequests((current) => current.map((request) => request._id === decisionTarget._id ? updated : request));
      setDecisionTarget(null);
      toast.success(status === 'accepted' ? 'Replacement assignment committed.' : 'Assignment request rejected.');
    } catch (error) {
      toast.error(getFriendlyError(error, 'The assignment decision could not be saved because the timetable may have changed. Refresh availability and try again.'));
    } finally {
      setIsDeciding(false);
    }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6"><div><p className="eyebrow">Institution operations</p><h1 className="page-title mt-2">Assignment review</h1><p className="page-lede mt-2 max-w-2xl">Review Faculty inability requests. Replacement options are calculated by the server for the exact class, day, period, and time before a decision is committed.</p></div><Button type="button" variant="outline" size="sm" icon={RefreshCw} onClick={loadRequests} disabled={isLoading}>Refresh</Button></header>
      {loadError && <div className="notice-error" role="alert"><p>{loadError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadRequests}>Try again</Button></div>}
      {isLoading ? <SkeletonCard /> : requests.length === 0 ? <EmptyState icon={ClipboardList} title="No assignment requests" message="Faculty inability requests will appear here after submission." /> : <div className="flex flex-col gap-4">{requests.map((request) => <Card key={request._id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="eyebrow">{request.class?.name || 'Class'} · {DAY_LABELS[request.dayOfWeek] || request.dayOfWeek} · Period {request.order}</p><h2 className="mt-1 text-lg font-semibold text-ink">{request.subject?.name || 'Assigned subject'}</h2><p className="mt-1 text-sm text-slate">{request.faculty?.name || 'Faculty'}{request.faculty?.email ? ` · ${request.faculty.email}` : ''} · submitted {request.createdAt ? format(new Date(request.createdAt), 'dd MMM yyyy, HH:mm') : 'recently'}</p></div><StatusPill status={request.status} /></div><div className="mt-4 border-l-2 border-line pl-4"><p className="whitespace-pre-wrap text-sm leading-6 text-ink">{request.reason}</p></div>{request.decisionReason && <div className="notice-error mt-4"><p className="text-xs font-semibold uppercase tracking-[0.14em]">HOD decision note</p><p className="mt-1 text-sm leading-6">{request.decisionReason}</p></div>}{request.status === 'accepted' && request.replacementFaculty && <p className="mt-4 text-sm text-sage">Replacement: <strong>{request.replacementFaculty.name}</strong></p>}{request.status === 'pending' && <div className="mt-5 flex justify-end"><Button type="button" icon={ClipboardList} onClick={() => beginDecision(request)}>Review request</Button></div>}</Card>)}</div>}
      {decisionTarget && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/35 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="assignment-review-title"><Card className="w-full max-w-xl p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{DAY_LABELS[decisionTarget.dayOfWeek]} · Period {decisionTarget.order}</p><h2 id="assignment-review-title" className="mt-1 text-xl font-semibold text-ink">Choose a decision</h2></div><button type="button" className="icon-button" onClick={() => setDecisionTarget(null)} aria-label="Close assignment review"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-slate">The current assignment remains in place if you reject. Acceptance replaces it only after the server confirms the selected Faculty is still free.</p><label className="field-label mt-5" htmlFor="replacement-faculty">Available replacement Faculty</label>{isLoadingAvailability ? <div className="mt-2 h-11 animate-pulse rounded-xl bg-surface" /> : availabilityError ? <div className="notice-error mt-2" role="alert"><p className="text-sm">{availabilityError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => beginDecision(decisionTarget)}>Try availability again</Button></div> : <select id="replacement-faculty" value={replacementFaculty} onChange={(event) => setReplacementFaculty(event.target.value)} className="field mt-2" aria-label="Available replacement Faculty"><option value="">Select a free Faculty member</option>{availableFaculty.map((faculty) => <option key={faculty._id} value={faculty._id}>{faculty.name}{faculty.employeeId ? ` · ${faculty.employeeId}` : ''}</option>)}</select>}{availableFaculty.length === 0 && !isLoadingAvailability && !availabilityError && <p className="mt-2 text-xs text-clay">No Faculty is currently free for this exact slot. Refresh after adjusting another timetable if needed.</p>}<label className="field-label mt-5" htmlFor="assignment-decision-reason">Rejection reason <span className="font-normal normal-case tracking-normal text-slate">(required only when rejecting)</span></label><textarea id="assignment-decision-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} maxLength={1000} className="field mt-2 min-h-24 resize-y" placeholder="Explain why the current Faculty assignment must remain." aria-label="Assignment decision reason" /><div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDecisionTarget(null)} disabled={isDeciding}>Cancel</Button><Button type="button" variant="outline" icon={X} onClick={() => confirmDecision('rejected')} isLoading={isDeciding} disabled={decisionReason.trim().length < 5}>Reject and keep assignment</Button><Button type="button" icon={Check} onClick={() => confirmDecision('accepted')} isLoading={isDeciding} disabled={!replacementFaculty || isLoadingAvailability || Boolean(availabilityError)}>Accept and replace</Button></div></Card></div>}
    </motion.div>
  );
}

export default function AssignmentRequestsPage({ mode = 'faculty' }) {
  return mode === 'hod' ? <HodRequestPage /> : <FacultyRequestPage />;
}
