import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Check, CheckCheck, ChevronDown, MessageCircle, MoreHorizontal, Pencil, Send, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import Avatar from './Avatar.jsx';
import Button from '../common/Button.jsx';
import { buildThreadItems } from '../../utils/messageThread.js';
import { displayName, roleLabel } from '../../utils/messagingRoles.js';

export const MAX_BODY_LENGTH = 5000;
const idString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

function Bubble({ item, own, editing, editingBody, setEditingBody, onStartEdit, onCancelEdit, onSaveEdit, onDelete, busy }) {
  const { message, startsGroup, endsGroup } = item;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  return (
    <li className={clsx('group flex', own ? 'justify-end' : 'justify-start', startsGroup ? 'mt-3' : 'mt-0.5')}>
      <div className={clsx('relative max-w-[85%] sm:max-w-[70%]')}>
        <div onClick={() => { if (!editing && window.matchMedia?.('(hover: none)').matches) setMenuOpen((open) => !open); }} className={clsx('rounded-lg px-3.5 py-2 text-sm leading-6', own ? 'bg-accent text-white' : 'border border-line bg-surface text-ink', own ? (startsGroup ? '' : 'rounded-tr-md') + (endsGroup ? '' : ' rounded-br-md') : (startsGroup ? '' : 'rounded-tl-md') + (endsGroup ? '' : ' rounded-bl-md'))}>
          {editing ? (
            <div className="min-w-[220px] sm:min-w-[320px]">
              <textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} maxLength={MAX_BODY_LENGTH} rows={3} autoFocus aria-label="Edit message"
                onKeyDown={(event) => { if (event.key === 'Escape') onCancelEdit(); }}
                className="w-full resize-y rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm text-white focus:border-white focus:outline-none" />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={onCancelEdit} disabled={busy} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10"><X size={13} aria-hidden="true" />Cancel</button>
                <button type="button" onClick={onSaveEdit} disabled={busy || !editingBody.trim()} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-accent hover:bg-white/90 disabled:opacity-60">Save</button>
              </div>
            </div>
          ) : <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        </div>
        {endsGroup && !editing && (
          <p className={clsx('mt-1 flex items-center gap-1 text-[11px] text-slate', own ? 'justify-end' : 'justify-start')}>
            {message.editedAt && <span>Edited ·</span>}
            <time dateTime={message.createdAt}>{format(new Date(message.createdAt), 'h:mm a')}</time>
            {own && (message.readAt
              ? <span className="inline-flex items-center gap-0.5 text-accent"><CheckCheck size={13} aria-hidden="true" /><span>Seen</span></span>
              : <span className="inline-flex items-center gap-0.5"><Check size={13} aria-hidden="true" /><span>Sent</span></span>)}
          </p>
        )}
        {!editing && (
          <div ref={menuRef} className={clsx('absolute top-0 -translate-y-1/2', own ? '-left-2 -translate-x-full' : '-right-2 translate-x-full')}>
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Actions for message sent at ${format(new Date(message.createdAt), 'h:mm a')}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate opacity-0 transition-opacity hover:bg-paper-dim focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"><MoreHorizontal size={16} aria-hidden="true" /></button>
            {menuOpen && (
              <div role="menu" className={clsx('absolute top-9 z-20 min-w-48 overflow-hidden rounded-md border border-line bg-surface py-1 text-sm shadow-lg', own ? 'right-0' : 'left-0')}>
                {own && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onStartEdit(message); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink hover:bg-paper-dim"><Pencil size={14} aria-hidden="true" />Edit</button>}
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(message, 'me'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-clay hover:bg-clay-light"><Trash2 size={14} aria-hidden="true" />Delete for me</button>
                {own && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(message, 'everyone'); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-clay hover:bg-clay-light"><Trash2 size={14} aria-hidden="true" />Delete for everyone</button>}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function MessageThread({
  conversation, actorId, messages, hasMore, isLoading, isLoadingOlder, error, scrollSignal,
  draft, setDraft, isSending, sendError, onSend, onLoadOlder, onRetry, onBack, onOpenProfile,
  editingId, editingBody, setEditingBody, onStartEdit, onCancelEdit, onSaveEdit, onDelete, actionBusy,
}) {
  const scrollerRef = useRef(null);
  const composerRef = useRef(null);
  const stickRef = useRef(true);
  const anchorRef = useRef(null);
  const items = useMemo(() => buildThreadItems(messages), [messages]);
  const recipient = conversation?.recipient;

  // Keep the view pinned to the newest message unless the reader has scrolled up.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (anchorRef.current !== null) {
      scroller.scrollTop = scroller.scrollHeight - anchorRef.current;
      anchorRef.current = null;
    } else if (stickRef.current) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [items.length, isLoading, scrollSignal]);

  useEffect(() => { stickRef.current = true; composerRef.current?.focus(); }, [conversation?._id]);

  function handleScroll(event) {
    const el = event.currentTarget;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  function loadOlder() {
    const scroller = scrollerRef.current;
    if (scroller) anchorRef.current = scroller.scrollHeight - scroller.scrollTop;
    onLoadOlder();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
      event.preventDefault();
      onSend();
    }
  }

  if (!conversation) {
    return (
      <section className="hidden min-h-0 flex-col items-center justify-center gap-2 bg-paper px-6 text-center lg:flex" aria-label="Conversation">
        <MessageCircle size={28} className="text-slate/50" aria-hidden="true" />
        <p className="font-display font-semibold text-ink">Select a conversation</p>
        <p className="text-sm text-slate">Choose a conversation on the left, or start a new message.</p>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col bg-paper" aria-label={`Conversation with ${displayName(recipient)}`}>
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-3 sm:px-4">
        <span className="lg:hidden"><button type="button" onClick={onBack} aria-label="Back to conversations" className="icon-button"><ArrowLeft size={18} aria-hidden="true" /></button></span>
        <button type="button" onClick={() => onOpenProfile(recipient)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Avatar account={recipient} />
          <span className="min-w-0"><span className="block truncate font-semibold text-ink">{displayName(recipient)}</span><span className="block truncate text-xs text-slate">{recipient?.isTutor ? 'Tutor' : roleLabel(recipient?.role)} · View profile</span></span>
          <ChevronDown size={16} className="ml-auto shrink-0 text-slate" aria-hidden="true" />
        </button>
      </header>

      <div ref={scrollerRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" role="log" aria-live="polite" aria-label="Messages">
        {error ? (
          <div className="notice-error" role="alert"><p className="flex-1 text-sm">{error}</p><Button type="button" size="sm" variant="outline" onClick={onRetry}>Try again</Button></div>
        ) : isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading messages">{[60, 40, 70].map((w, i) => <div key={i} className={clsx('skeleton h-10 rounded-lg', i % 2 ? 'ml-auto' : '')} style={{ width: `${w}%` }} />)}</div>
        ) : (
          <>
            {hasMore && <div className="mb-2 text-center"><Button type="button" variant="ghost" size="sm" isLoading={isLoadingOlder} onClick={loadOlder}>Load earlier messages</Button></div>}
            {items.length === 0 ? (
              <div className="py-16 text-center"><p className="text-sm font-medium text-ink">No messages yet</p><p className="mt-1 text-xs text-slate">Say hello to {displayName(recipient)}.</p></div>
            ) : (
              <ol>
                {items.map((item) => item.type === 'day' ? (
                  <li key={item.key} className="my-4 flex items-center gap-3 text-xs font-medium text-slate" aria-label={item.label}><span className="h-px flex-1 bg-line" /><span>{item.label}</span><span className="h-px flex-1 bg-line" /></li>
                ) : (
                  <Bubble key={item.key} item={item} own={idString(item.message.sender) === idString(actorId)} editing={String(editingId) === String(item.message._id)}
                    editingBody={editingBody} setEditingBody={setEditingBody} onStartEdit={onStartEdit} onCancelEdit={onCancelEdit} onSaveEdit={() => onSaveEdit(item.message)} onDelete={onDelete} busy={actionBusy} />
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); onSend(); }} className="border-t border-line bg-surface p-3 sm:p-4">
        {sendError && <p className="mb-2 text-sm text-clay" role="alert">{sendError}</p>}
        <div className="flex items-end gap-2">
          <label htmlFor="message-body" className="sr-only">Message to {displayName(recipient)}</label>
          <textarea id="message-body" ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} maxLength={MAX_BODY_LENGTH} rows={1}
            placeholder="Write a message" className="field max-h-40 flex-1 resize-none" style={{ fieldSizing: 'content' }} />
          <Button type="submit" icon={Send} isLoading={isSending} disabled={!draft.trim()} aria-label="Send message">Send</Button>
        </div>
        <p className="mt-1.5 flex justify-between text-[11px] text-slate"><span>Enter to send, Shift+Enter for a new line</span>{draft.length > MAX_BODY_LENGTH - 500 && <span className="tabular-nums">{draft.length.toLocaleString()} / {MAX_BODY_LENGTH.toLocaleString()}</span>}</p>
      </form>
    </section>
  );
}
