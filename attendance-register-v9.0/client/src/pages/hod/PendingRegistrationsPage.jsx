import { motion } from 'framer-motion';
import { fadeUp } from '../../utils/motion.js';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { UserCheck, UserX, Users, Clock } from 'lucide-react';
import { registrationRequestApi } from '../../api/registration.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'];
const STATUS_VARIANT = { pending: 'amber', approved: 'present', rejected: 'absent' };

export default function PendingRegistrationsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await registrationRequestApi.list(activeTab);
      setRequests(data.data.requests || []);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Page could not be loaded.');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id, name) {
    setIsActioning(true);
    try {
      await registrationRequestApi.approve(id);
      toast.success(`${name}'s registration approved. Account created.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not approve request.');
    } finally {
      setIsActioning(false);
    }
  }

  async function handleReject() {
    setIsActioning(true);
    try {
      await registrationRequestApi.reject(rejectTarget._id, rejectReason);
      toast.success('Registration request rejected.');
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reject request.');
    } finally {
      setIsActioning(false);
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Registration Requests</h1>
        <p className="mt-1 text-sm text-slate">Review and approve student self-registration requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink/8">
        {STATUS_TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'border-ink text-ink' : 'border-transparent text-slate hover:text-ink'
            }`}
          >
            {tab}
            {tab === 'pending' && pendingCount > 0 && activeTab !== 'pending' && (
              <span className="rounded-full bg-amber px-1.5 py-0.5 text-[10px] font-bold text-ink">
                {pendingCount}
              </span>
            )}
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
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/8 bg-ink/3 text-left text-xs font-semibold uppercase tracking-wide text-slate">
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Class</th>
                <th className="px-5 py-3">Submitted</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-ink">{r.name}</p>
                    <p className="text-xs text-slate">{r.email}</p>
                    {r.registerNumber && (
                      <p className="font-mono text-xs text-slate">{r.registerNumber}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ink/80">{r.class?.name}</td>
                  <td className="px-5 py-3.5 text-xs text-slate">
                    {format(new Date(r.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <Badge variant={STATUS_VARIANT[r.status] || 'neutral'}>{r.status}</Badge>
                      {r.status === 'rejected' && r.rejectionReason && (
                        <p className="text-xs text-slate">Reason: {r.rejectionReason}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="success"
                          icon={UserCheck}
                          isLoading={isActioning}
                          onClick={() => handleApprove(r._id, r.name)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={UserX}
                          onClick={() => { setRejectTarget(r); setRejectReason(''); }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={`Reject ${rejectTarget?.name}'s request`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate">Optionally provide a reason (visible to the student):</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. Register number already exists, please contact the office"
            className="w-full rounded-xl border border-ink/15 px-3.5 py-2.5 text-sm focus:border-ink/40 focus:outline-none"
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" onClick={handleReject} isLoading={isActioning}>Reject request</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
