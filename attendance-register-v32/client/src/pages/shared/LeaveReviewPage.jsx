import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Check, CheckCircle2, Clock3, RefreshCw, UserRound, X, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard } from '../../components/common/Skeleton.jsx';
import { leaveApi } from '../../api/workflows.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { fadeUp } from '../../utils/motion.js';

const copy = {
  hod: { eyebrow: 'Institution operations', title: 'Leave review', lede: 'Review leave requests across the institution and make decisions with a clear audit trail.' },
  faculty: { eyebrow: 'Tutor workspace', title: 'Tutor leave review', lede: 'Review requests from Students in your assigned tutor class. Subject assignments do not expand this scope.' },
};

const STATUS_META = {
  pending: { label: 'Pending', icon: Clock3, className: 'border-amber/25 bg-amber-light/50 text-amber', emptyTitle: 'No pending leave requests', emptyMessage: 'New requests will appear here when Students submit them.' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'border-sage/25 bg-sage-light/60 text-sage', emptyTitle: 'No approved leave requests', emptyMessage: 'Approved requests will appear here after a review decision.' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'border-clay/25 bg-clay-light/60 text-clay', emptyTitle: 'No rejected leave requests', emptyMessage: 'Rejected requests will appear here with the reviewer’s reason.' },
};
const STATUS_ORDER = ['pending', 'approved', 'rejected'];

function RequestStatus({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}><Icon size={13} />{meta.label}</span>;
}

function DecisionMeta({ request }) {
  if (!request || request.status === 'pending') return null;
  const decisionLabel = request.status === 'approved' ? 'Approved' : 'Rejected';
  const reviewer = request.decidedBy?.name || 'an authorized reviewer';
  const date = request.decidedAt ? format(new Date(request.decidedAt), 'dd MMM yyyy, HH:mm') : 'date not available';
  return (
    <div className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3 text-sm ${request.status === 'approved' ? 'border-sage/20 bg-sage-light/45 text-sage' : 'border-clay/20 bg-clay-light/45 text-clay'}`}>
      <span className="inline-flex items-center gap-1.5 font-semibold"><UserRound size={14} />{decisionLabel} by {reviewer}</span>
      <span className="text-xs opacity-80">{date}</span>
    </div>
  );
}

export default function LeaveReviewPage({ mode = 'faculty' }) {
  const content = copy[mode] || copy.faculty;
  const [requests, setRequests] = useState([]);
  const [activeStatus, setActiveStatus] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await leaveApi.list();
      setRequests(data?.data?.requests || []);
    } catch (err) {
      setRequests([]);
      setLoadError(getFriendlyError(err, 'Leave requests could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const counts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((status) => [status, requests.filter((request) => request.status === status).length])), [requests]);
  const visibleRequests = useMemo(() => requests.filter((request) => request.status === activeStatus), [activeStatus, requests]);

  function beginDecision(request, status) {
    setDecisionTarget({ ...request, nextStatus: status });
    setDecisionReason('');
  }

  async function confirmDecision() {
    if (!decisionTarget) return;
    if (decisionTarget.nextStatus === 'rejected' && decisionReason.trim().length < 5) return;
    setIsDeciding(true);
    try {
      const { data } = await leaveApi.decide(decisionTarget._id, { status: decisionTarget.nextStatus, ...(decisionTarget.nextStatus === 'rejected' ? { decisionReason: decisionReason.trim() } : {}) });
      const updated = data?.data?.request;
      setRequests((current) => current.map((request) => request._id === decisionTarget._id ? updated : request));
      setDecisionTarget(null);
      setDecisionReason('');
      toast.success(`Leave request ${decisionTarget.nextStatus}.`);
    } catch (err) {
      toast.error(getFriendlyError(err, 'The leave decision could not be saved.'));
    } finally {
      setIsDeciding(false);
    }
  }

  const empty = STATUS_META[activeStatus];

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6"><div><p className="eyebrow">{content.eyebrow}</p><h1 className="page-title mt-2">{content.title}</h1><p className="page-lede mt-2 max-w-2xl">{content.lede}</p></div><Button type="button" variant="outline" size="sm" icon={RefreshCw} onClick={loadRequests} disabled={isLoading}>Refresh</Button></header>
      {loadError && <div className="notice-error" role="alert"><p>{loadError}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadRequests}>Try again</Button></div>}
      <nav className="grid grid-cols-3 gap-2" aria-label="Leave request status"><div className="sr-only" role="status" aria-live="polite">Showing {empty.label.toLowerCase()} leave requests.</div>{STATUS_ORDER.map((status) => { const meta = STATUS_META[status]; const Icon = meta.icon; return <button key={status} type="button" role="tab" aria-selected={activeStatus === status} onClick={() => { setActiveStatus(status); setDecisionTarget(null); }} className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition-colors sm:px-4 ${activeStatus === status ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-slate hover:border-ink/25 hover:text-ink'}`}><span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold sm:text-sm"><Icon size={15} className="shrink-0" /><span className="truncate">{meta.label}</span></span><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeStatus === status ? 'bg-paper/15 text-paper' : 'bg-ink/5 text-ink'}`}>{counts[status]}</span></button>; })}</nav>
      {isLoading ? <SkeletonCard /> : visibleRequests.length === 0 ? <EmptyState icon={empty.icon} title={empty.emptyTitle} message={mode === 'faculty' && activeStatus === 'pending' ? 'Requests for your tutor class will appear here.' : empty.emptyMessage} /> : <div className="flex flex-col gap-4" role="tabpanel" aria-label={`${empty.label} leave requests`}>{visibleRequests.map((request) => <Card key={request._id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="eyebrow">{request.class?.name || 'Assigned class'}</p><h2 className="mt-1 text-lg font-semibold text-ink">{request.student?.name || 'Student'}</h2><p className="mt-1 text-xs text-slate">{request.student?.registerNumber || request.student?.email || 'Student record'} · submitted {request.createdAt ? format(new Date(request.createdAt), 'dd MMM yyyy, HH:mm') : '—'}</p></div><RequestStatus status={request.status} /></div><div className="mt-4 border-l-2 border-line pl-4"><p className="whitespace-pre-wrap text-sm leading-6 text-ink">{request.reason}</p></div><DecisionMeta request={request} />{request.status === 'rejected' && request.decisionReason && <div className="notice-error mt-4"><p className="text-xs font-semibold uppercase tracking-[0.14em]">Rejection reason</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{request.decisionReason}</p></div>}{request.status === 'pending' && <>{decisionTarget?._id === request._id ? <div className="mt-5 border-t border-line pt-4"><p className="text-sm font-semibold text-ink">{decisionTarget.nextStatus === 'rejected' ? 'Why is this request being rejected?' : 'Approve this request?'}</p>{decisionTarget.nextStatus === 'rejected' && <textarea value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} maxLength={1000} className="field mt-3 min-h-24 resize-y" placeholder="Give the Student a clear reason (at least 5 characters)." aria-label="Rejection reason" />}{decisionTarget.nextStatus === 'approved' && <p className="mt-1 text-sm text-slate">The Student will be notified of the approval.</p>}<div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDecisionTarget(null)} disabled={isDeciding}>Cancel</Button><Button type="button" variant={decisionTarget.nextStatus === 'rejected' ? 'danger' : 'primary'} icon={decisionTarget.nextStatus === 'rejected' ? X : Check} onClick={confirmDecision} isLoading={isDeciding} disabled={decisionTarget.nextStatus === 'rejected' && decisionReason.trim().length < 5}>{decisionTarget.nextStatus === 'rejected' ? 'Reject request' : 'Approve request'}</Button></div></div> : <div className="mt-5 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" icon={X} onClick={() => beginDecision(request, 'rejected')}>Reject</Button><Button type="button" icon={Check} onClick={() => beginDecision(request, 'approved')}>Approve</Button></div>}</>}</Card>)}</div>}
    </motion.div>
  );
}
