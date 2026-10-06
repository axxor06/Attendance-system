import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, UsersRound } from 'lucide-react';
import { userApi } from '../../api/users.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Badge from '../../components/common/Badge.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

export default function FacultyStudentsPage() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const loadStudents = useCallback(async ({ signal } = {}) => {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError('');
    try {
      const { data } = await userApi.assignedStudents({ search: debouncedSearch || undefined, page, limit: 25 }, { signal });
      if (signal?.aborted || requestId !== requestSequence.current) return;
      const payload = data?.data || {};
      if (!Array.isArray(payload.students)) throw new Error('The assigned-students response was invalid.');
      setStudents(payload.students);
      setPagination(payload.pagination || { page, pages: 1, total: payload.students.length, limit: 25 });
    } catch (err) {
      if (signal?.aborted || requestId !== requestSequence.current || err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
      setStudents([]);
      setPagination({ page, pages: 1, total: 0, limit: 25 });
      setError(getFriendlyError(err, 'Unable to load assigned students.'));
    } finally {
      if (!signal?.aborted && requestId === requestSequence.current) setIsLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => {
    const controller = new AbortController();
    loadStudents({ signal: controller.signal });
    return () => controller.abort();
  }, [loadStudents]);

  return <div className="space-y-7"><header className="border-b border-line pb-6"><p className="eyebrow">Teaching desk</p><h1 className="page-title mt-2">Assigned students</h1><p className="page-lede mt-2 max-w-2xl">A read-only roster of learners connected to your active subjects. Attendance and reports remain limited to these assignments.</p></header><div className="directory-toolbar"><div className="directory-search" aria-busy={isLoading}><Search size={17} className="directory-search-icon" aria-hidden="true" /><input className="field directory-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assigned students" aria-label="Search assigned students" /></div><span className="flex shrink-0 items-center gap-2 text-sm text-slate">{isLoading && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo"><span className="h-2 w-2 animate-pulse rounded-full bg-indigo" />Searching</span>}{pagination.total} student{pagination.total === 1 ? '' : 's'}</span></div>{isLoading ? <SkeletonTable cols={4} /> : error ? <div className="notice-error" role="alert"><p>{error}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => loadStudents()}>Try again</Button></div> : students.length === 0 ? <EmptyState icon={UsersRound} title="No assigned students" message={search ? 'Try a different search term.' : 'Students appear here when they are enrolled in one of your active subjects.'} /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="directory-table min-w-[680px] w-full text-sm"><caption className="sr-only">Students assigned to your subjects</caption><thead><tr><th>Name</th><th>Register number</th><th>Class</th><th>Status</th></tr></thead><tbody>{students.map((student) => <tr key={student._id}><td><p className="font-semibold text-ink">{student.name}</p><p className="mt-0.5 text-xs text-slate">{student.email}</p></td><td className="font-mono text-xs text-slate">{student.registerNumber || '—'}</td><td className="text-ink/75">{student.class?.name || 'Unassigned'}</td><td><Badge variant={student.isActive ? 'present' : 'absent'}>{student.isActive ? 'Active' : 'Inactive'}</Badge></td></tr>)}</tbody></table></div></Card>}{!isLoading && !error && pagination.pages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate"><span>Page {pagination.page} of {pagination.pages}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" icon={ChevronLeft} disabled={pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button type="button" variant="outline" size="sm" icon={ChevronRight} disabled={pagination.page >= pagination.pages} onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))}>Next</Button></div></div>}</div>;
}
