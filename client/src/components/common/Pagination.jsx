import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button.jsx';

/** Server-side pagination footer. `pagination` is the API's { page, pages, total, limit }. */
export default function Pagination({ pagination, onPageChange, disabled = false, noun = 'results' }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, pages, total, limit } = pagination;
  const first = (page - 1) * limit + 1;
  const last = Math.min(total, page * limit);
  return (
    <nav className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-slate sm:flex-row" aria-label="Pagination">
      <p aria-live="polite">Showing <span className="tabular-nums font-medium text-ink">{first}–{last}</span> of <span className="tabular-nums font-medium text-ink">{total}</span> {noun}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" icon={ChevronLeft} disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
        <span className="min-w-[5.5rem] text-center tabular-nums">Page {page} of {Math.max(pages, 1)}</span>
        <Button type="button" variant="outline" size="sm" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}>Next<ChevronRight aria-hidden="true" size={14} /></Button>
      </div>
    </nav>
  );
}
