import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { attendanceApi } from '../../api/attendance.js';
import Badge from '../common/Badge.jsx';
import Button from '../common/Button.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Pagination from '../common/Pagination.jsx';
import { SkeletonTable } from '../common/Skeleton.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';

const SOURCE_LABEL = { correction: 'Correction', edit: 'Edit', resubmit: 'Re-submitted' };
const dayString = (date) => format(date, 'yyyy-MM-dd');

/** Read-only, paginated audit trail of every attendance status change. */
export default function CorrectionLog({ showCorrector = true }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await attendanceApi.correctionHistory({ page, limit: 25, from: from || undefined, to: to || undefined });
      setRows(data?.data?.corrections || []);
      setPagination(data?.data?.pagination || null);
    } catch (err) {
      setRows([]);
      setError(getFriendlyError(err, 'The correction history could not be loaded.'));
    } finally { setIsLoading(false); }
  }, [page, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [from, to]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">Corrected from
          <input type="date" value={from} max={to || dayString(new Date())} onChange={(event) => setFrom(event.target.value)} className="field field-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">Corrected to
          <input type="date" value={to} min={from || undefined} max={dayString(new Date())} onChange={(event) => setTo(event.target.value)} className="field field-sm" />
        </label>
        {(from || to) && <Button type="button" variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</Button>}
      </div>

      {isLoading ? <SkeletonTable cols={5} /> : error ? (
        <div className="notice-error" role="alert"><p className="flex-1 text-sm">{error}</p><Button type="button" size="sm" variant="outline" onClick={load}>Try again</Button></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title="No corrections yet" message="Changes to saved attendance are listed here with who made them and when." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <caption className="sr-only">Attendance corrections, newest first</caption>
              <thead><tr className="border-b border-line bg-paper-dim text-left text-xs font-semibold text-slate">
                <th scope="col" className="px-4 py-3">When</th><th scope="col" className="px-4 py-3">Student</th><th scope="col" className="px-4 py-3">Session</th>
                <th scope="col" className="px-4 py-3">Change</th>{showCorrector && <th scope="col" className="px-4 py-3">Changed by</th>}<th scope="col" className="px-4 py-3">Reason</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row._id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate">{format(new Date(row.createdAt), 'd MMM yyyy, h:mm a')}</td>
                    <td className="px-4 py-3"><p className="font-medium text-ink">{row.student?.name || 'Student'}</p><p className="font-mono text-xs text-slate">{row.student?.registerNumber || ''}</p></td>
                    <td className="px-4 py-3"><p className="text-ink">{row.subject?.name || 'Subject'}</p><p className="text-xs text-slate">{row.class?.name} · {row.periodName || `Period ${row.periodOrder}`} · {format(new Date(row.date), 'd MMM yyyy', { })}</p></td>
                    <td className="px-4 py-3"><span className="inline-flex flex-wrap items-center gap-1.5">{row.previousStatus ? <Badge variant={row.previousStatus}>{row.previousStatus}</Badge> : <span className="text-xs text-slate">Not marked</span>}<span aria-label="changed to">→</span><Badge variant={row.newStatus}>{row.newStatus}</Badge></span><p className="mt-1 text-[11px] text-slate">{SOURCE_LABEL[row.source] || row.source}</p></td>
                    {showCorrector && <td className="px-4 py-3 text-ink-light">{row.correctedBy?.name || '—'}</td>}
                    <td className="max-w-[16rem] break-words px-4 py-3 text-ink-light">{row.reason || <span className="text-slate">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} noun="corrections" />
        </div>
      )}
    </div>
  );
}
