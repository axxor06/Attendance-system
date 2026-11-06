import { useMemo, useState } from 'react';
import { formatDistanceToNowStrict, isToday } from 'date-fns';
import { MessageSquarePlus, Search } from 'lucide-react';
import clsx from 'clsx';
import Avatar from './Avatar.jsx';
import Button from '../common/Button.jsx';
import CountBadge from '../common/CountBadge.jsx';
import { displayName, roleLabel } from '../../utils/messagingRoles.js';

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return isToday(date) ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : formatDistanceToNowStrict(date, { addSuffix: false }).replace(/ (\w)\w*/, '$1');
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-line" aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3.5">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2"><div className="skeleton h-3 w-2/5" /><div className="skeleton h-3 w-4/5" /></div>
        </li>
      ))}
    </ul>
  );
}

export default function ConversationList({ conversations, activeId, isLoading, error, hasMore, isLoadingMore, onSelect, onNewMessage, onLoadMore, onRetry }) {
  const [filter, setFilter] = useState('all');
  const [term, setTerm] = useState('');
  const unreadTotal = useMemo(() => conversations.reduce((sum, conversation) => sum + (Number(conversation.unreadCount) || 0), 0), [conversations]);
  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === 'unread' && !(Number(conversation.unreadCount) > 0)) return false;
      return !needle || displayName(conversation.recipient).toLowerCase().includes(needle);
    });
  }, [conversations, filter, term]);

  return (
    <section className="flex min-h-0 flex-col bg-surface" aria-label="Conversations">
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">Conversations</h2>
          <Button type="button" size="sm" icon={MessageSquarePlus} onClick={onNewMessage}>New message</Button>
        </div>
        {conversations.length > 0 && (
          <>
            <div className="relative">
              <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input type="search" value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Search your conversations by name" placeholder="Search conversations" className="field field-sm field-icon" />
            </div>
            <div className="flex gap-1" role="group" aria-label="Filter conversations">
              {[['all', 'All'], ['unread', 'Unread']].map(([key, label]) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
                  className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', filter === key ? 'bg-ink text-white' : 'text-slate hover:bg-paper-dim hover:text-ink')}>
                  {label}{key === 'unread' && unreadTotal > 0 && <span className="tabular-nums">{unreadTotal}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? <ListSkeleton /> : error ? (
          <div className="m-4 notice-error" role="alert"><p className="flex-1 text-sm">{error}</p><Button type="button" size="sm" variant="outline" onClick={onRetry}>Try again</Button></div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-paper-dim text-slate" aria-hidden="true"><MessageSquarePlus size={22} /></span>
            <div><p className="font-display font-semibold text-ink">No conversations yet</p><p className="mt-1 text-sm text-slate">Search for someone you can message to start a conversation.</p></div>
            <Button type="button" icon={MessageSquarePlus} onClick={onNewMessage}>New message</Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate">{filter === 'unread' && !term ? 'No unread conversations.' : 'No conversations match your search.'}</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((conversation) => {
              const unread = Number(conversation.unreadCount) || 0;
              const active = String(activeId) === String(conversation._id);
              return (
                <li key={conversation._id}>
                  <button type="button" onClick={() => onSelect(conversation._id)} aria-current={active ? 'true' : undefined}
                    className={clsx('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent', active ? 'bg-accent-light/60' : 'hover:bg-paper')}>
                    <Avatar account={conversation.recipient} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={clsx('truncate text-sm text-ink', unread ? 'font-semibold' : 'font-medium')}>{displayName(conversation.recipient)}</span>
                        <span className="shrink-0 text-[11px] text-slate">{shortTime(conversation.lastMessage?.sentAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={clsx('truncate text-xs', unread ? 'font-medium text-ink' : 'text-slate')}>{conversation.lastMessage?.preview || 'No messages yet'}</span>
                        <CountBadge count={unread} label="unread messages" />
                      </span>
                      <span className="sr-only">{conversation.recipient?.isTutor ? 'Tutor' : roleLabel(conversation.recipient?.role)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && !isLoading && !error && <div className="border-t border-line p-3 text-center"><Button type="button" variant="ghost" size="sm" isLoading={isLoadingMore} onClick={onLoadMore}>Show more conversations</Button></div>}
      </div>
    </section>
  );
}
