import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { BadgeCheck, Clock, Eye, RefreshCw, Search, UserCheck, UserX, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { registrationRequestApi } from '../../api/registration.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Input from '../../components/common/Input.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import CountBadge from '../../components/common/CountBadge.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import RequestDetails from '../../components/registration/RequestDetails.jsx';
import { isFacultyRequest } from '../../utils/registrationRequest.js';
import { requestBadgeRefresh } from '../../context/BadgeContext.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { fadeUp } from '../../utils/motion.js';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'];
const ROLE_FILTERS = [{ value: '', label: 'All applicants' }, { value: 'student', label: 'Students' }, { value: 'faculty', label: 'Faculty' }];
const STATUS_VARIANT = { pending: 'amber', approved: 'present', rejected: 'absent' };
const PAGE_SIZE = 25;

const identifierLabel = (request) => (isFacultyRequest(request) ? 'Employee ID' : 'Register number');
const identifierPlaceholder = (request) => (isFacultyRequest(request) ? 'e.g. FAC-2026-014' : 'e.g. 23CSE045');

export default function PendingRegistrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('pending');
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [detailTarget, setDetailTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [assignedIdentifier, setAssignedIdentifier] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const deepLinkHandled = useRef(null);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setIsRefreshing(true); else setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await registrationRequestApi.list({ status: activeTab, role: role || undefined, search: debouncedSearch || undefined, page, limit: PAGE_SIZE, sort: activeTab === 'pending' ? 'oldest' : 'newest' });
      setRequests(Array.isArray(data?.data?.requests) ? data.data.requests : []);
      setPagination(data?.data?.pagination || null);
      setSummary(data?.data?.summary || null);
    } catch (err) {
      setLoadError(getFriendlyError(err, 'Registration requests could not be loaded.'));
      setRequests([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, role, debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [activeTab, role, debouncedSearch]);

  // Deep link from a notification: /hod/registrations?request=<id> opens that request.
  useEffect(() => {
    const requestId = searchParams.get('request');
    if (!requestId || deepLinkHandled.current === requestId) return;
    deepLinkHandled.current = requestId;
    registrationRequestApi.get(requestId)
      .then(({ data }) => setDetailTarget(data?.data?.request || null))
      .catch((err) => toast.error(getFriendlyError(err, 'That request could not be opened.')));
  }, [searchParams]);

  function closeDetail() {
    setDetailTarget(null);
    if (searchParams.get('request')) { const next = new URLSearchParams(searchParams); next.delete('request'); setSearchParams(next, { replace: true }); }
  }

  function openApprove(request) { setApproveTarget(request); setAssignedIdentifier(''); }
  function closeApprove(force = false) { if (isActioning && !force) return; setApproveTarget(null); setAssignedIdentifier(''); }
  function closeReject(force = false) { if (isActioning && !force) return; setRejectTarget(null); setRejectReason(''); }

  async function afterDecision() {
    setDetailTarget(null);
    requestBadgeRefresh();
    await load();
  }

  async function handleApprove() {
    const identifier = assignedIdentifier.trim();
    if (!approveTarget || !identifier) return;
    setIsActioning(true);
    try {
      await registrationRequestApi.approve(approveTarget._id, identifier);
      toast.success(`${approveTarget.name}'s registration was approved.`);
      closeApprove(true);
      await afterDecision();
    } catch (err) {
      toast.error(getFriendlyError(err, `Could not approve this request.`));
      await load();
    } finally { setIsActioning(false); }
  }

  async function handleReject() {
    if (!rejectTarget || rejectReason.trim().length < 5) return;
    setIsActioning(true);
    try {
      await registrationRequestApi.reject(rejectTarget._id, rejectReason.trim());
      toast.success('Registration request rejected.');
      closeReject(true);
      await afterDecision();
    } catch (err) {
      toast.error(getFriendlyError(err, 'Could not reject this request.'));
      await load();
    } finally { setIsActioning(false); }
  }

  const tabCount = (tab) => (tab === 'pending' && summary ? summary.pending : null);
  const filtered = Boolean(role || debouncedSearch);

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Registration requests</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate">Review each applicant's details, then approve to create the account or reject with a reason. You assign the final register number or employee ID.</p>
        </div>
        <Button type="button" variant="outline" size="sm" icon={RefreshCw} isLoading={isRefreshing} disabled={isLoading || isActioning} onClick={() => { requestBadgeRefresh(); load({ refresh: true }); }}>Refresh</Button>
      </header>

      {summary && (
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-center sm:text-left" aria-label="Pending requests">
          {[['Pending', summary.pending], ['Students', summary.students], ['Faculty', summary.faculty]].map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-3"><dt className="text-xs font-medium text-slate">{label}</dt><dd className="font-mono text-xl font-semibold tabular-nums text-ink">{value}</dd></div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex gap-1 overflow-x-auto border-b border-line lg:border-b-0" role="tablist" aria-label="Request status">
          {STATUS_TABS.map((tab) => (
            <button type="button" key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? 'border-ink text-ink' : 'border-transparent text-slate hover:text-ink'}`}>
              {tab}<CountBadge count={tabCount(tab)} label="pending" />
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-64">
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
            <input type="search" aria-label="Search applicants by name or email" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" maxLength={80} className="field field-sm field-icon" />
          </div>
          <select aria-label="Filter by applicant type" value={role} onChange={(event) => setRole(event.target.value)} className="field field-sm sm:w-44">
            {ROLE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? <SkeletonTable cols={5} /> : loadError ? (
        <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert">
          <p className="font-semibold text-clay">Requests could not be loaded.</p>
          <p className="mt-1 text-sm text-clay/80">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => load()}>Try again</Button>
        </Card>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={activeTab === 'pending' && !filtered ? Clock : Users}
          title={filtered ? 'No matching requests' : activeTab === 'pending' ? 'No pending requests' : `No ${activeTab === 'all' ? '' : activeTab} requests`}
          message={filtered ? 'Try a different name, email or applicant type.' : activeTab === 'pending' ? 'New student and faculty registrations will appear here for review.' : 'Nothing to show for this status yet.'}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-dim text-left text-xs font-semibold text-slate">
                  <th scope="col" className="px-5 py-3">Applicant</th>
                  <th scope="col" className="px-5 py-3">Placement</th>
                  <th scope="col" className="px-5 py-3">Submitted</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {requests.map((request) => (
                  <tr key={request._id} className="align-top transition-colors hover:bg-paper/70">
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => setDetailTarget(request)} className="text-left font-semibold text-ink hover:text-accent hover:underline">{request.name}</button>
                      <p className="mt-0.5 text-xs text-slate">{isFacultyRequest(request) ? 'Faculty' : 'Student'} · {request.email}</p>
                      {request.status === 'approved' && request.assignedIdentifier && <p className="mt-0.5 font-mono text-xs text-slate">Assigned {request.assignedIdentifier}</p>}
                    </td>
                    <td className="px-5 py-4 text-ink/80">{isFacultyRequest(request) ? request.department?.name || '—' : request.class?.name || '—'}</td>
                    <td className="px-5 py-4 text-xs text-slate">{format(new Date(request.createdAt), 'd MMM yyyy')}</td>
                    <td className="px-5 py-4">
                      <Badge variant={STATUS_VARIANT[request.status] || 'neutral'}>{request.status}</Badge>
                      {request.status === 'rejected' && request.rejectionReason && <p className="mt-1 max-w-xs text-xs leading-5 text-slate">{request.rejectionReason}</p>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" icon={Eye} onClick={() => setDetailTarget(request)}>Details</Button>
                        {request.status === 'pending' && (
                          <>
                            <Button type="button" size="sm" variant="success" icon={UserCheck} disabled={isActioning} onClick={() => openApprove(request)}>Approve</Button>
                            <Button type="button" size="sm" variant="danger" icon={UserX} disabled={isActioning} onClick={() => { setRejectTarget(request); setRejectReason(''); }}>Reject</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} disabled={isLoading} noun="requests" />
        </Card>
      )}

      <Modal isOpen={Boolean(detailTarget)} onClose={closeDetail} title={detailTarget ? `${detailTarget.name}'s request` : 'Request'} maxWidth="max-w-2xl">
        {detailTarget && (
          <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
            <RequestDetails request={detailTarget} />
            {detailTarget.status === 'pending' && (
              <div className="sticky bottom-0 -mx-1 flex flex-wrap justify-end gap-2 border-t border-line bg-cream px-1 pt-3">
                <Button type="button" variant="danger" icon={UserX} disabled={isActioning} onClick={() => { setRejectTarget(detailTarget); setRejectReason(''); setDetailTarget(null); }}>Reject</Button>
                <Button type="button" variant="success" icon={UserCheck} disabled={isActioning} onClick={() => { openApprove(detailTarget); setDetailTarget(null); }}>Approve</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

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
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-light" htmlFor="registration-rejection-reason">Rejection reason <span className="text-[10px] font-semibold normal-case tracking-normal text-slate/60">Required</span></label>
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
