import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, CheckCircle2, Clock3, FileText, MessageSquareText, Send, UserRound, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import { leaveApi } from '../../api/workflows.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { fadeUp } from '../../utils/motion.js';

const STATUS_META = {
  pending: { label: 'Pending', icon: Clock3, className: 'border-amber/25 bg-amber-light/50 text-amber', emptyTitle: 'No pending leave requests', emptyMessage: 'New requests will appear here while they await review.' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'border-sage/25 bg-sage-light/60 text-sage', emptyTitle: 'No approved leave requests', emptyMessage: 'Approved requests will appear here after your tutor or HOD decides.' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'border-clay/25 bg-clay-light/60 text-clay', emptyTitle: 'No rejected leave requests', emptyMessage: 'Rejected requests will appear here with the reviewer’s reason.' },
};
const STATUS_ORDER = ['pending', 'approved', 'rejected'];

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}><Icon size={13} />{meta.label}</span>;
}

function DecisionMeta({ request }) {
  if (!request || request.status === 'pending') return null;
  const decisionLabel = request.status === 'approved' ? 'Approved' : 'Rejected';
  const reviewer = request.decidedBy?.name || 'an authorized reviewer';
  const date = request.decidedAt ? format(new Date(request.decidedAt), 'dd MMM yyyy, HH:mm') : 'date not available';
  return <div className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3 text-sm ${request.status === 'approved' ? 'border-sage/20 bg-sage-light/45 text-sage' : 'border-clay/20 bg-clay-light/45 text-clay'}`}><span className="inline-flex items-center gap-1.5 font-semibold"><UserRound size={14} />{decisionLabel} by {reviewer}</span><span className="text-xs opacity-80">{date}</span></div>;
}

export default function StudentLeaveRequestsPage() {
  const [reason, setReason] = useState('');
  const [requests, setRequests] = useState([]);
  const [activeStatus, setActiveStatus] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await leaveApi.list();
      setRequests(data?.data?.requests || []);
    } catch (err) {
      setRequests([]);
      setError(getFriendlyError(err, 'Leave requests could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const counts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((status) => [status, requests.filter((request) => request.status === status).length])), [requests]);
  const visibleRequests = useMemo(() => requests.filter((request) => request.status === activeStatus), [activeStatus, requests]);
  const activeMeta = STATUS_META[activeStatus];

  async function submitRequest(event) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError('Please provide at least five characters explaining your leave request.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const { data } = await leaveApi.create({ reason: trimmed });
      setRequests((current) => [data?.data?.request, ...current].filter(Boolean));
      setActiveStatus('pending');
      setReason('');
      toast.success('Leave request sent to your tutor and HOD.');
    } catch (err) {
      setError(getFriendlyError(err, 'Leave request could not be submitted.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <header className="border-b border-line pb-6"><p className="eyebrow">Student requests</p><h1 className="page-title mt-2">Leave requests</h1><p className="page-lede mt-2 max-w-2xl">Send one clear request to your class tutor and HOD. Every decision shows who reviewed it, when it was decided, and any feedback.</p></header>

      <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper"><FileText size={18} /></div><div><h2 className="font-display text-lg font-semibold text-ink">Start a leave request</h2><p className="mt-1 text-sm text-slate">Keep the explanation specific. Your tutor and HOD will receive the request for review.</p></div></div><form className="mt-5" onSubmit={submitRequest}><label className="field-label" htmlFor="leave-reason">Reason for leave</label><textarea id="leave-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} maxLength={2000} placeholder="Explain the dates or circumstances for your leave request…" className="field mt-2 min-h-32 resize-y leading-6" required /><div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate"><span>Do not include passwords, OTPs, or unnecessary private information.</span><span>{reason.length}/2000</span></div>{error && <p className="notice-error mt-4 text-sm" role="alert">{error}</p>}<div className="mt-5 flex justify-end"><Button type="submit" icon={Send} isLoading={isSubmitting} disabled={isSubmitting || reason.trim().length < 5}>Send request</Button></div></form></Card>

      <section aria-labelledby="leave-history-heading"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Request history</p><h2 id="leave-history-heading" className="mt-1 font-display text-lg font-semibold text-ink">Your submitted requests</h2></div><Button type="button" variant="outline" size="sm" onClick={loadRequests} disabled={isLoading}>Refresh</Button></div><nav className="mb-4 grid grid-cols-3 gap-2" aria-label="Leave request status"><div className="sr-only" role="status" aria-live="polite">Showing {activeMeta.label.toLowerCase()} leave requests.</div>{STATUS_ORDER.map((status) => { const meta = STATUS_META[status]; const Icon = meta.icon; return <button key={status} type="button" role="tab" aria-selected={activeStatus === status} onClick={() => setActiveStatus(status)} className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition-colors sm:px-4 ${activeStatus === status ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-slate hover:border-ink/25 hover:text-ink'}`}><span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold sm:text-sm"><Icon size={15} className="shrink-0" /><span className="truncate">{meta.label}</span></span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeStatus === status ? 'bg-paper/15 text-paper' : 'bg-ink/5 text-ink'}`}>{counts[status]}</span></button>; })}</nav>{isLoading ? <SkeletonCard /> : visibleRequests.length === 0 ? <EmptyState icon={activeMeta.icon} title={activeMeta.emptyTitle} message={activeMeta.emptyMessage} /> : <div className="flex flex-col gap-3" role="tabpanel" aria-label={`${activeMeta.label} leave requests`}>{visibleRequests.map((request) => <Card key={request._id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">Submitted {request.createdAt ? format(new Date(request.createdAt), 'dd MMM yyyy, HH:mm') : '—'}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{request.reason}</p></div><StatusBadge status={request.status} /></div><DecisionMeta request={request} />{request.status === 'rejected' && <div className="mt-4 overflow-hidden rounded-2xl border border-clay/25 bg-clay-light/45"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-clay/15 px-4 py-3"><div className="flex items-start gap-2.5"><div className="mt-0.5 rounded-lg bg-clay/15 p-1.5 text-clay"><MessageSquareText size={15} /></div><div><p className="text-sm font-semibold text-ink">This request was not approved</p><p className="mt-0.5 text-xs text-clay/80">Reviewer feedback is included below so you know what to do next.</p></div></div><span className="text-xs font-medium text-clay">{request.decidedAt ? format(new Date(request.decidedAt), 'dd MMM yyyy') : 'Review completed'}</span></div>{request.decisionReason ? <div className="px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-clay/80">Reason from {request.decidedBy?.name || 'your reviewer'}</p><blockquote className="mt-2 border-l-2 border-clay/45 pl-3 text-sm leading-6 text-ink">{request.decisionReason}</blockquote><div className="mt-3 flex items-start gap-2 border-t border-clay/15 pt-3 text-xs leading-5 text-slate"><ArrowRight size={14} className="mt-0.5 shrink-0 text-clay" /><p><strong className="text-ink">Next step:</strong> Review the feedback and submit a new request with any missing details or supporting context.</p></div></div> : <p className="px-4 py-3 text-sm text-slate">No additional reason was provided. Contact your class tutor if you need clarification.</p>}</div>}</Card>)}</div>}</section>
    </motion.div>
  );
}
