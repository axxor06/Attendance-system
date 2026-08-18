import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FileText, FileSpreadsheet, Search } from 'lucide-react';
import { attendanceApi } from '../../api/attendance.js';
import { reportApi } from '../../api/misc.js';
import { dashboardApi } from '../../api/misc.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import SubjectAttendanceChart from '../../components/charts/SubjectAttendanceChart.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';

export default function StudentAttendancePage() {
  const [history, setHistory] = useState([]);
  const [subjectWise, setSubjectWise] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadAttendance = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const [historyResult, dashboardResult] = await Promise.allSettled([
      attendanceApi.history({ limit: 200 }),
      dashboardApi.student(),
    ]);
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value.data?.data?.records || []);
    if (dashboardResult.status === 'fulfilled') setSubjectWise(dashboardResult.value.data?.data?.subjectWise || []);
    if (historyResult.status === 'rejected' || dashboardResult.status === 'rejected') {
      setLoadError('Some attendance data could not be loaded. Retry when the connection is ready.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  async function handleDownload(format) {
    setDownloading(format);
    try {
      await reportApi.downloadStudentReport(undefined, format);
    } catch {
      toast.error('Could not generate report.');
    } finally {
      setDownloading(null);
    }
  }

  const filtered = history.filter(r => {
    const matchesSearch = !search ||
      r.subject?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.periodName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    present: history.filter(r => r.status === 'present').length,
    absent: history.filter(r => r.status === 'absent').length,
    late: history.filter(r => r.status === 'late').length,
  };

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">My Attendance</h1>
          <p className="mt-1 text-sm text-slate">Full history and subject-wise breakdown</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" icon={FileText}
            isLoading={downloading === 'pdf'} onClick={() => handleDownload('pdf')}>
            PDF
          </Button>
          <Button size="sm" variant="outline" icon={FileSpreadsheet}
            isLoading={downloading === 'excel'} onClick={() => handleDownload('excel')}>
            Excel
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="border-clay/20 bg-clay-light/60 px-5 py-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-clay">Attendance data needs attention</p><p className="mt-1 text-sm text-clay/80">{loadError}</p></div>
            <Button type="button" variant="outline" onClick={loadAttendance}>Retry</Button>
          </div>
        </Card>
      )}

      {/* Quick stats */}
      {!isLoading && (
        <motion.div
          className="grid grid-cols-3 gap-3"
          variants={staggerContainer} initial="initial" animate="animate"
        >
          {[
            { label: 'Present', count: statusCounts.present, color: 'text-sage', bg: 'bg-sage-light' },
            { label: 'Absent', count: statusCounts.absent, color: 'text-clay', bg: 'bg-clay-light' },
            { label: 'Late', count: statusCounts.late, color: 'text-amber', bg: 'bg-amber/15' },
          ].map(({ label, count, color, bg }) => (
            <motion.div key={label} variants={staggerItem}
              className={`rounded-2xl ${bg} px-4 py-3 text-center`}>
              <p className={`font-display text-2xl font-semibold ${color}`}>{count}</p>
              <p className={`text-xs font-medium ${color} opacity-80`}>{label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Chart */}
      {!isLoading && subjectWise.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Subject-wise attendance</h2>
          <SubjectAttendanceChart data={subjectWise} />
        </Card>
      )}

      {/* History table */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink/8 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink flex-1">Full history</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate/60" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subject..."
              className="w-44 rounded-xl border border-ink/12 bg-paper py-1.5 pl-8 pr-3 text-xs focus:border-ink/30 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl border border-ink/12 bg-paper px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="all">All status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="excused">Excused</option>
          </select>
          {(search || filterStatus !== 'all') && (
              <button type="button" onClick={() => { setSearch(''); setFilterStatus('all'); }}
              className="text-xs text-ink/50 hover:text-ink">
              Clear
            </button>
          )}
        </div>

        {isLoading ? (
          <SkeletonTable cols={4} rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No records found" message={search || filterStatus !== 'all' ? 'Try adjusting your filters.' : 'Your attendance records will appear here.'} />
        ) : (
          <div className="divide-y divide-ink/5">
            {filtered.map((r, i) => (
              <motion.div
                key={r._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-2 w-2 shrink-0 rounded-full status-dot-${r.status}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.subject?.name}</p>
                    <p className="text-xs text-slate">
                      {format(new Date(r.date), 'MMM d, yyyy')} · {r.periodName}
                    </p>
                  </div>
                </div>
                <Badge variant={r.status}>{r.status}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
