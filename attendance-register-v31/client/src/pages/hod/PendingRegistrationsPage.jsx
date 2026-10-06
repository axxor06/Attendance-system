import { getFriendlyError } from '../../utils/errorMessages.js';
import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion.js';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { BadgeCheck, UserCheck, UserX, Users, Clock, RefreshCw } from 'lucide-react';
import { registrationRequestApi } from '../../api/registration.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Input from '../../components/common/Input.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'];
const STATUS_VARIANT = { pending: 'amber', approved: 'present', rejected: 'absent' };

function isFacultyRequest(request) {
  return ['faculty', 'admin'].includes(String(request?.requestedRole || '').toLowerCase());
}

function requestedRoleLabel(request) {
  return isFacultyRequest(request) ? 'Faculty' : 'Student';
}

function identifierLabel(request) {
  return isFacultyRequest(request) ? 'Employee ID' : 'Register number';
}

function identifierPlaceholder(request) {
  return isFacultyRequest(request) ? 'e.g. FAC-2026-014' : 'e.g. 23CSE045';
}

export default function PendingRegistrationsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [assignedIdentifier, setAssignedIdentifier] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await registrationRequestApi.list(activeTab);
      const next = Array.isArray(data?.data?.requests) ? data.data.requests : [];
      setRequests(next.filter((request) => activeTab === 'all' || request.status === activeTab));
    } catch (err) {
      setLoadError(getFriendlyError(err, 'Page could not be loaded.'));
      setRequests([]);
    } finally {
      if (refresh) setIsRefreshing(false);
      else setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  function openApprove(request) {
    setApproveTarget(request);
    setAssignedIdentifier('');
  }

  function closeApprove(force = false) {
    if (isActioning && !force) return;
    setApproveTarget(null);
    setAssignedIdentifier('');
  }

  async function handleApprove() {
    const identifier = assignedIdentifier.trim();
    if (!approveTarget || !identifier) return;
    setIsActioning(true);
    try {
      await registrationRequestApi.approve(approveTarget._id, identifier);
      toast.success(`${approveTarget.name}'s registration was approved.`);
      closeApprove(true);
      await load();
    } catch (err) {
      toast.error(getFriendlyError(err, `Could not assign this ${identifierLabel(approveTarget).toLowerCase()}.`));
    } finally {
      setIsActioning(false);
    }
  }

  function closeReject(force = false) {
    if (isActioning && !force) return;
    setRejectTarget(null);
    setRejectReason('');
  }

  async function handleReject() {
    if (!rejectTarget || rejectReason.trim().length < 5) return;
    setIsActioning(true);
    try {
      await registrationRequestApi.reject(rejectTarget._id, rejectReason.trim());
      toast.success('Registration request rejected with a reason.');
      closeReject(true);
      await load();
    } catch (err) {
      toast.error(getFriendlyError(err, 'Could not reject request.'));
    } finally {
      setIsActioning(false);
    }
  }

  const pendingCount = requests.filter((request) => request.status === 'pending').length;

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <header className="flex flex-col gap-2 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Admissions review</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Registration Requests</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate">Applicants submit their academic details. You assign the final register number or employee ID only after review.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 && <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-light px-3 py-1.5 text-xs font-bold text-ink"><Clock size={14} />{pendingCount} awaiting review</span>}
          <Button type="button" variant="outline" size="sm" icon={RefreshCw} isLoading={isRefreshing} disabled={isLoading || isActioning} onClick={() => load({ refresh: true })}>Refresh</Button>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Registration request status">
        {STATUS_TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? 'border-ink text-ink' : 'border-transparent text-slate hover:text-ink'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable cols={5} />
      ) : loadError ? (
        <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert">
          <p className="font-semibold text-clay">Page could not be loaded.</p>
          <p className="mt-1 text-sm text-clay/80">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={load}>Try again</Button>
        </Card>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={activeTab === 'pending' ? Clock : Users}
          title={`No ${activeTab === 'all' ? '' : activeTab} requests`}
          message={activeTab === 'pending' ? 'All caught up — no pending requests.' : `No ${activeTab} requests found.`}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-dim text-left text-xs font-semibold uppercase tracking-wide text-slate">
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Placement</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {requests.map((request) => (
                  <tr key={request._id} className="align-top transition-colors hover:bg-paper/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{request.name}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-sage">{requestedRoleLabel(request)}</p>
                      <p className="mt-1 text-xs text-slate">{request.email}</p>
                      {request.status === 'approved' && request.assignedIdentifier && <p className="mt-1 font-mono text-xs text-slate">Assigned: {request.assignedIdentifier}</p>}
                    </td>
                    <td className="px-5 py-4 text-ink/80">{isFacultyRequest(request) ? request.department?.name || 'Department pending' : request.class?.name || 'Class pending'}</td>
                    <td className="px-5 py-4 text-xs text-slate">{format(new Date(request.createdAt), 'MMM d, yyyy')}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        <Badge variant={STATUS_VARIANT[request.status] || 'neutral'}>{request.status}</Badge>
                        {request.status === 'rejected' && request.rejectionReason && <p className="max-w-xs text-xs leading-5 text-slate">Reason: {request.rejectionReason}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {request.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="success" icon={UserCheck} disabled={isActioning} onClick={() => openApprove(request)}>Review & approve</Button>
                          <Button type="button" size="sm" variant="danger" icon={UserX} disabled={isActioning} onClick={() => { setRejectTarget(request); setRejectReason(''); }}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal isOpen={Boolean(approveTarget)} onClose={closeApprove} title={`Approve ${approveTarget?.name}'s request`}>
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-sage/25 bg-sage-light/70 p-4 text-sm text-sage"><div className="flex items-start gap-2"><BadgeCheck className="mt-0.5 shrink-0" size={17} /><p>The applicant did not choose an internal identifier. Assign a unique <strong>{identifierLabel(approveTarget).toLowerCase()}</strong> before this account is created.</p></div></div>
          <Input label={identifierLabel(approveTarget)} required value={assignedIdentifier} onChange={(event) => setAssignedIdentifier(event.target.value)} placeholder={identifierPlaceholder(approveTarget)} hint="Uniqueness is checked again by the server when you approve." />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeApprove} disabled={isActioning}>Cancel</Button>
            <Button type="button" variant="success" icon={UserCheck} onClick={handleApprove} isLoading={isActioning} disabled={!assignedIdentifier.trim()}>Assign and approve</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(rejectTarget)} onClose={closeReject} title={`Reject ${rejectTarget?.name}'s request`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-slate">Provide a clear reason. It is visible on the applicant’s secure request-status page.</p>
          <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-ink/65" htmlFor="registration-rejection-reason">Rejection reason <span className="text-[10px] font-semibold normal-case tracking-normal text-slate/60">Required</span></label>
          <textarea id="registration-rejection-reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={4} maxLength={500} placeholder="Explain what the applicant needs to correct or whom to contact." className="field min-h-28 resize-y" />
          <p className="-mt-2 text-right text-xs text-slate">{rejectReason.length} / 500</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeReject} disabled={isActioning}>Cancel</Button>
            <Button type="button" variant="danger" icon={UserX} onClick={handleReject} isLoading={isActioning} disabled={rejectReason.trim().length < 5}>Reject request</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
