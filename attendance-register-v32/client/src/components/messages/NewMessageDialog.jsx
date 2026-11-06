import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { messagesApi } from '../../api/messages.js';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Avatar from './Avatar.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { displayName, roleLabel } from '../../utils/messagingRoles.js';

const MIN_QUERY = 2;
const PAGE = 20;

/**
 * Recipient picker. Nothing is requested until the person types at least two characters
 * or picks a category, and the server only ever returns people they may message.
 */
export default function NewMessageDialog({ isOpen, onClose, groups, onStart }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState('');
  const debounced = useDebouncedValue(query.trim(), 300);
  const requestRef = useRef(0);
  const canSearch = debounced.length >= MIN_QUERY || group !== 'all';

  const run = useCallback(async (page, append) => {
    const requestId = ++requestRef.current;
    if (append) setIsLoadingMore(true); else { setIsLoading(true); setError(''); }
    try {
      const { data } = await messagesApi.recipients({ search: debounced.length >= MIN_QUERY ? debounced : undefined, group, page, limit: PAGE });
      if (requestId !== requestRef.current) return;
      const next = Array.isArray(data?.data?.recipients) ? data.data.recipients : [];
      setResults((current) => (append ? [...current, ...next.filter((item) => !current.some((existing) => existing._id === item._id))] : next));
      setPagination(data?.data?.pagination || null);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      if (!append) setResults([]);
      setError(getFriendlyError(err, 'People could not be loaded.'));
    } finally {
      if (requestId === requestRef.current) { setIsLoading(false); setIsLoadingMore(false); }
    }
  }, [debounced, group]);

  useEffect(() => {
    if (!isOpen) return;
    if (!canSearch) { requestRef.current += 1; setResults([]); setPagination(null); setError(''); setIsLoading(false); return; }
    run(1, false);
  }, [isOpen, canSearch, run]);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setGroup('all'); setResults([]); setPagination(null); setError(''); setStartingId(''); }
  }, [isOpen]);

  async function choose(recipient) {
    if (startingId) return;
    setStartingId(recipient._id);
    try { await onStart(recipient); } finally { setStartingId(''); }
  }

  const hasMore = pagination && pagination.page < pagination.pages;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New message" maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
          <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search people by name, email or ID" placeholder="Search by name, email or ID" maxLength={80} className="field field-icon" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Browse by category">
          {groups.map((item) => (
            <button key={item.key} type="button" aria-pressed={group === item.key} onClick={() => setGroup(group === item.key ? 'all' : item.key)}
              className={clsx('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', group === item.key ? 'border-ink bg-ink text-white' : 'border-line text-slate hover:border-ink/40 hover:text-ink')}>{item.label}</button>
          ))}
        </div>

        <div className="min-h-40" aria-live="polite">
          {!canSearch ? (
            <p className="px-2 py-10 text-center text-sm text-slate">Type at least two letters, or choose a category, to find people you can message.</p>
          ) : isLoading ? (
            <ul className="space-y-2" aria-busy="true" aria-label="Searching">{Array.from({ length: 4 }).map((_, i) => <li key={i} className="skeleton h-14 rounded-md" />)}</ul>
          ) : error ? (
            <div className="notice-error" role="alert"><p className="flex-1 text-sm">{error}</p><Button type="button" size="sm" variant="outline" onClick={() => run(1, false)}>Try again</Button></div>
          ) : results.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-slate">No one matches. You can only message people connected to your classes and department.</p>
          ) : (
            <>
              <ul className="max-h-[46vh] divide-y divide-line overflow-y-auto rounded-md border border-line">
                {results.map((recipient) => (
                  <li key={recipient._id}>
                    <button type="button" onClick={() => choose(recipient)} disabled={Boolean(startingId)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:opacity-60">
                      <Avatar account={recipient} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{displayName(recipient)}</span>
                        <span className="block truncate text-xs text-slate">{recipient.isTutor ? 'Tutor' : roleLabel(recipient.role)}{recipient.class?.name ? ` · ${recipient.class.name}` : recipient.department?.name ? ` · ${recipient.department.name}` : ''}</span>
                      </span>
                      {startingId === recipient._id ? <span className="text-xs text-slate">Opening…</span> : <UserRound aria-hidden="true" size={15} className="text-slate/60" />}
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && <div className="mt-2 text-center"><Button type="button" variant="ghost" size="sm" isLoading={isLoadingMore} onClick={() => run((pagination.page || 1) + 1, true)}>Show more</Button></div>}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
