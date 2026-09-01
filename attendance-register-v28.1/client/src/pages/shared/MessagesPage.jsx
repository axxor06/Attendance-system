import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCheck, ChevronDown, Edit3, MessageCircle, MoreHorizontal, Plus, Search, Send, Trash2, UserRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { messagesApi } from '../../api/messages.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonCard, SkeletonTable } from '../../components/common/Skeleton.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { fadeUp } from '../../utils/motion.js';
import { requestSingleFlight } from '../../utils/requestSingleFlight.js';

const MAX_BODY_LENGTH = 5000;

const GROUPS_BY_ROLE = {
  super_admin: [
    { key: 'all', label: 'All' },
    { key: 'students', label: 'Students' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'tutors', label: 'Tutors' },
  ],
  admin: [
    { key: 'all', label: 'All' },
    { key: 'students', label: 'Students' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'tutors', label: 'Tutors' },
    { key: 'hod', label: 'HOD' },
  ],
  user: [
    { key: 'all', label: 'All' },
    { key: 'students', label: 'Students' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'tutors', label: 'Tutors' },
    { key: 'hod', label: 'HOD' },
  ],
};

function normalizeRole(role) {
  if (role === 'super_admin' || role === 'superadmin' || role === 'hod') return 'super_admin';
  if (role === 'admin' || role === 'faculty') return 'admin';
  return 'user';
}

function roleLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'super_admin') return 'HOD';
  if (normalized === 'admin') return 'Faculty';
  return 'Student';
}

function displayName(account) {
  return account?.name || account?.email || 'Account';
}

function initials(account) {
  return displayName(account).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A';
}

function idString(value) {
  return value?._id?.toString?.() || value?.toString?.() || '';
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString() === new Date().toLocaleDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function conversationInGroup(conversation, groupKey) {
  if (groupKey === 'all') return true;
  if (groupKey === 'tutors') return Boolean(conversation.recipient?.isTutor);
  const role = normalizeRole(conversation.recipient?.role);
  if (groupKey === 'students') return role === 'user';
  if (groupKey === 'faculty') return role === 'admin';
  if (groupKey === 'hod') return role === 'super_admin';
  return false;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedConversationId = searchParams.get('conversation') || '';
  const actorId = user?._id || user?.id;
  const userRole = normalizeRole(user?.role);
  const groups = GROUPS_BY_ROLE[userRole] || GROUPS_BY_ROLE.user;
  const defaultGroup = groups[0]?.key || 'all';
  const [conversations, setConversations] = useState([]);
  const [conversationPagination, setConversationPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [activeId, setActiveId] = useState(requestedConversationId);
  const [thread, setThread] = useState([]);
  const [threadPagination, setThreadPagination] = useState({ page: 1, pages: 1, total: 0, limit: 30 });
  const [conversationGroup, setConversationGroup] = useState(defaultGroup);
  const [isAddChatOpen, setIsAddChatOpen] = useState(false);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState([]);
  const [isRecipientLoading, setIsRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteMode, setDeleteMode] = useState(null);
  const [isMessageActionLoading, setIsMessageActionLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [profileTarget, setProfileTarget] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const conversationRequestRef = useRef(0);
  const recipientRequestRef = useRef(0);
  const threadRequestRef = useRef(0);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => String(conversation._id) === String(activeId)) || null,
    [activeId, conversations],
  );

  const unreadTotal = useMemo(
    () => conversations.reduce((total, conversation) => total + (Number(conversation.unreadCount) || 0), 0),
    [conversations],
  );

  const visibleConversations = useMemo(() => conversations.filter((conversation) => conversationInGroup(conversation, conversationGroup)), [conversations, conversationGroup]);

  const loadConversations = useCallback(async (page = 1, { silent = false } = {}) => {
    const requestId = ++conversationRequestRef.current;
    if (!silent) setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await requestSingleFlight(`message-conversations:${idString(actorId) || 'current'}:${page}`, () => messagesApi.conversations({ page, limit: 20 }));
      const next = data?.data?.conversations;
      if (!Array.isArray(next)) throw new Error('Conversation response did not contain a valid list.');
      if (requestId !== conversationRequestRef.current) return;
      setConversations(next);
      setConversationPagination(data?.data?.pagination || { page, pages: 1, total: next.length, limit: 20 });
      setActiveId((current) => requestedConversationId || current || next[0]?._id || '');
    } catch (error) {
      if (requestId === conversationRequestRef.current) {
        setConversations([]);
        setActiveId('');
        setLoadError(getFriendlyError(error, 'Messages could not be loaded.'));
      }
    } finally {
      if (requestId === conversationRequestRef.current && !silent) setIsLoading(false);
    }
  }, [actorId, requestedConversationId]);

  const loadThread = useCallback(async (conversationId, page = 1, { markRead = true, silent = false } = {}) => {
    if (!conversationId) {
      setThread([]);
      return;
    }
    const requestId = ++threadRequestRef.current;
    if (!silent) setIsThreadLoading(true);
    try {
      const { data } = await requestSingleFlight(`message-thread:${idString(actorId) || 'current'}:${conversationId}:${page}`, () => messagesApi.messages(conversationId, { page, limit: 30 }));
      const next = data?.data?.messages;
      if (!Array.isArray(next)) throw new Error('Message response did not contain a valid list.');
      if (requestId !== threadRequestRef.current) return;
      setThread(next);
      setThreadPagination(data?.data?.pagination || { page, pages: 1, total: next.length, limit: 30 });
      const hasUnreadIncoming = next.some((message) => idString(message.recipient) === idString(actorId) && !message.readAt);
      if (markRead && hasUnreadIncoming) {
        await requestSingleFlight(`message-mark-read:${idString(actorId) || 'current'}:${conversationId}`, () => messagesApi.markRead(conversationId));
        if (requestId === threadRequestRef.current) {
          setConversations((current) => current.map((conversation) => (
            String(conversation._id) === String(conversationId) ? { ...conversation, unreadCount: 0 } : conversation
          )));
        }
      }
    } catch (error) {
      if (requestId === threadRequestRef.current && !silent) {
        setThread([]);
        toast.error(getFriendlyError(error, 'This conversation could not be loaded.'));
      }
    } finally {
      if (requestId === threadRequestRef.current && !silent) setIsThreadLoading(false);
    }
  }, [actorId]);

  useEffect(() => {
    loadConversations(1);
  }, [loadConversations]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadConversations(1, { silent: true });
    };
    const timer = window.setInterval(refreshWhenVisible, 15000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadConversations]);

  useEffect(() => {
    setConversationGroup((current) => groups.some((group) => group.key === current) ? current : defaultGroup);
  }, [groups, defaultGroup]);

  const loadRecipients = useCallback(async (query, group = conversationGroup) => {
    const normalizedQuery = String(query || '').trim();
    if (normalizedQuery.length < 2) {
      setRecipientResults([]);
      setRecipientError('');
      return;
    }
    const requestId = ++recipientRequestRef.current;
    setIsRecipientLoading(true);
    setRecipientError('');
    try {
      const { data } = await requestSingleFlight(`message-recipients:${idString(actorId) || 'current'}:${group}:${normalizedQuery.toLowerCase()}`, () => messagesApi.recipients({ search: normalizedQuery, group, page: 1, limit: 25 }));
      const next = data?.data?.recipients;
      if (!Array.isArray(next)) throw new Error('Recipient response did not contain a valid list.');
      if (requestId === recipientRequestRef.current) setRecipientResults(next);
    } catch (error) {
      if (requestId === recipientRequestRef.current) {
        setRecipientResults([]);
        setRecipientError(getFriendlyError(error, 'Recipients could not be loaded.'));
      }
    } finally {
      if (requestId === recipientRequestRef.current) setIsRecipientLoading(false);
    }
  }, [actorId, conversationGroup]);

  useEffect(() => {
    if (!isAddChatOpen) return undefined;
    const query = recipientQuery.trim();
    if (query.length < 2) {
      setRecipientResults([]);
      setRecipientError('');
      return undefined;
    }
    const timer = window.setTimeout(() => loadRecipients(query, conversationGroup), 280);
    return () => window.clearTimeout(timer);
  }, [conversationGroup, isAddChatOpen, loadRecipients, recipientQuery]);

  useEffect(() => {
    loadThread(activeId, 1);
  }, [activeId, loadThread]);

  useEffect(() => {
    if (requestedConversationId) setActiveId(requestedConversationId);
  }, [requestedConversationId]);

  useEffect(() => {
    if (!activeId) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadThread(activeId, threadPagination.page, { markRead: true, silent: true });
    }, 12000);
    return () => window.clearInterval(timer);
  }, [activeId, loadThread, threadPagination.page]);

  useEffect(() => {
    if (!profileTarget) {
      setProfile(null);
      setProfileError('');
      return undefined;
    }
    let active = true;
    setProfileLoading(true);
    setProfileError('');
    requestSingleFlight(`message-profile:${idString(actorId) || 'current'}:${profileTarget}`, () => messagesApi.profile(profileTarget))
      .then(({ data }) => { if (active) setProfile(data?.data?.profile || null); })
      .catch((error) => { if (active) setProfileError(getFriendlyError(error, 'Profile details could not be loaded.')); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [actorId, profileTarget]);

  useEffect(() => {
    if (!messageMenuId) return undefined;
    const closeMenu = (event) => {
      if (!event.target.closest('[data-message-menu]')) setMessageMenuId(null);
    };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMessageMenuId(null); };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [messageMenuId]);

  async function handleEditMessage(message) {
    const body = editingBody.trim();
    if (!activeId || !message?._id || !body || isMessageActionLoading) return;
    setIsMessageActionLoading(true);
    try {
      const { data } = await messagesApi.edit(activeId, message._id, { body });
      const edited = data?.data?.message;
      if (!edited?._id) throw new Error('The edited message response was invalid.');
      setThread((current) => current.map((item) => String(item._id) === String(edited._id) ? edited : item));
      setEditingMessageId(null);
      setEditingBody('');
      setMessageMenuId(null);
      await loadConversations(1, { silent: true });
    } catch (error) {
      toast.error(getFriendlyError(error, 'Message could not be edited.'));
    } finally {
      setIsMessageActionLoading(false);
    }
  }

  async function handleDeleteMessage() {
    if (!activeId || !deleteTarget || isMessageActionLoading) return;
    setIsMessageActionLoading(true);
    try {
      await messagesApi.remove(activeId, deleteTarget._id, deleteMode);
      setThread((current) => current.filter((item) => String(item._id) !== String(deleteTarget._id)));
      setDeleteTarget(null);
      setDeleteMode(null);
      setMessageMenuId(null);
      await loadConversations(1, { silent: true });
      toast.success(deleteMode === 'everyone' ? 'Message deleted for everyone.' : 'Message deleted for you.');
    } catch (error) {
      toast.error(getFriendlyError(error, 'Message could not be deleted.'));
    } finally {
      setIsMessageActionLoading(false);
    }
  }

  async function handleSend(event) {
    event?.preventDefault?.();
    const body = draft.trim();
    if (!activeId || !body || isSending) return;
    setIsSending(true);
    try {
      const { data } = await messagesApi.send(activeId, { body });
      const sent = data?.data?.message;
      if (!sent?._id) throw new Error('Message response was invalid.');
      setThread((current) => current.some((message) => String(message._id) === String(sent._id)) ? current : [...current, sent]);
      setDraft('');
      await loadConversations(1, { silent: true });
    } catch (error) {
      toast.error(getFriendlyError(error, 'Message could not be sent.'));
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
      event.preventDefault();
      handleSend(event);
    }
  }

  function openProfile(account) {
    const id = idString(account);
    if (id) setProfileTarget(id);
  }

  function closeAddChat() {
    if (isRecipientLoading) return;
    setIsAddChatOpen(false);
    setRecipientQuery('');
    setRecipientResults([]);
    setRecipientError('');
  }

  async function startConversation(recipientId) {
    if (!recipientId) return;
    try {
      const { data } = await messagesApi.createConversation(recipientId);
      const conversation = data?.data?.conversation;
      if (!conversation?._id) throw new Error('The conversation response was invalid.');
      setConversations((current) => [conversation, ...current.filter((item) => String(item._id) !== String(conversation._id))]);
      setActiveId(conversation._id);
      closeAddChat();
      await loadConversations(1, { silent: true });
    } catch (error) {
      toast.error(getFriendlyError(error, 'That conversation could not be started.'));
    }
  }

  return (
    <motion.div className="space-y-5 xl:space-y-7" {...fadeUp}>
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Private conversations</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="page-title">Messages</h1>
            {unreadTotal > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-light px-2.5 py-1 text-xs font-bold text-sage"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{unreadTotal > 99 ? '99+' : unreadTotal} unread</span>}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">Simple, private conversations with the people connected to your academic work.</p>
        </div>
        <Button type="button" icon={Plus} onClick={() => setIsAddChatOpen(true)}>Add chat</Button>
      </header>
      <nav className="flex max-w-full gap-1 overflow-x-auto border-b border-line pb-1" role="tablist" aria-label="Message conversation groups">
        {groups.map((group) => <button key={group.key} type="button" role="tab" aria-selected={conversationGroup === group.key} onClick={() => setConversationGroup(group.key)} className={`min-h-10 shrink-0 rounded-xl px-4 text-xs font-bold transition-[background-color,color,transform] duration-160 ${conversationGroup === group.key ? 'bg-sage text-white shadow-[0_5px_14px_rgba(15,128,105,0.18)]' : 'text-slate hover:bg-sage-light hover:text-ink'}`}>{group.label}</button>)}
      </nav>

      {isLoading ? <SkeletonTable cols={2} rows={6} /> : loadError ? (
        <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert"><p className="font-semibold text-clay">Messages could not be loaded.</p><p className="mt-1 text-sm text-clay/80">{loadError}</p><Button type="button" variant="outline" className="mt-4" onClick={() => loadConversations(1)}>Try again</Button></Card>
      ) : (
        <Card className="overflow-hidden rounded-3xl border-line/90 p-0 shadow-[0_18px_52px_rgba(16,47,66,0.10)]">
          <div className="grid min-h-[min(700px,calc(100vh-240px))] lg:grid-cols-[minmax(280px,0.36fr)_minmax(0,0.64fr)]">
            <section className={`${activeId ? 'hidden lg:flex' : 'flex'} min-h-[560px] flex-col border-line bg-surface lg:border-r`} aria-label="Conversation list">
              <div className="border-b border-line bg-surface px-4 py-4 sm:px-5"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow text-sage">Inbox</p><h2 className="mt-1 font-semibold text-ink">Conversations</h2></div><span className="rounded-full bg-paper-dim px-2.5 py-1 text-xs font-bold text-slate">{visibleConversations.length}</span></div><p className="mt-1 text-xs text-slate">Your private threads</p></div>
              {visibleConversations.length === 0 ? <div className="p-5"><EmptyState icon={MessageCircle} title="No conversations in this group" message="Choose another group or wait for a conversation to begin." /></div> : <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto bg-paper/55">{visibleConversations.map((conversation) => { const unread = Number(conversation.unreadCount) || 0; return <button key={conversation._id} type="button" onClick={() => setActiveId(conversation._id)} className={`w-full px-4 py-4 text-left transition-[background-color,transform] duration-160 hover:bg-sage-light/70 ${String(activeId) === String(conversation._id) ? 'bg-sage-light shadow-[inset_3px_0_0_var(--color-sage)]' : ''}`}><div className="flex items-center gap-3"><Avatar account={conversation.recipient} size="sm" /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${unread > 0 ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>{displayName(conversation.recipient)}</span>{unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white" aria-label={`${unread} unread messages`}>{unread > 9 ? '9+' : unread}</span>}</span><span className="mt-0.5 flex items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold uppercase tracking-wide text-sage">{conversation.recipient?.isTutor ? 'Tutor' : roleLabel(conversation.recipient?.role)}</span><span className="shrink-0 text-[10px] text-slate/65">{formatMessageTime(conversation.lastMessage?.sentAt)}</span></span><span className={`mt-1 block truncate text-xs ${unread > 0 ? 'font-semibold text-ink' : 'text-slate'}`}>{conversation.lastMessage?.preview || 'No messages yet'}</span></span></div></button>; })}</div>}
              {conversationPagination.pages > 1 && <div className="flex items-center justify-between border-t border-line bg-paper px-4 py-3"><Button type="button" size="sm" variant="ghost" disabled={conversationPagination.page <= 1} onClick={() => loadConversations(conversationPagination.page - 1)}>Previous</Button><span className="text-xs font-semibold text-slate">{conversationPagination.page} / {conversationPagination.pages}</span><Button type="button" size="sm" variant="ghost" disabled={conversationPagination.page >= conversationPagination.pages} onClick={() => loadConversations(conversationPagination.page + 1)}>Next</Button></div>}
            </section>

            <section className={`${activeId ? 'flex' : 'hidden lg:flex'} min-h-[560px] flex-col bg-paper`} aria-label="Conversation thread">
              {!activeConversation ? <div className="flex flex-1 items-center justify-center p-8"><EmptyState icon={MessageCircle} title="Select a conversation" message="Choose a contact or thread to start chatting." /></div> : <>
                <div className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3 sm:px-6 sm:py-4"><button type="button" className="icon-button lg:hidden" onClick={() => setActiveId('')} aria-label="Back to conversations"><ArrowLeft size={18} /></button><button type="button" onClick={() => openProfile(activeConversation.recipient)} className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"><Avatar account={activeConversation.recipient} /><span className="min-w-0"><span className="block truncate font-semibold text-ink">{displayName(activeConversation.recipient)}</span><span className="mt-0.5 block truncate text-xs text-slate">{activeConversation.recipient?.isTutor ? 'Tutor' : roleLabel(activeConversation.recipient?.role)} · View profile</span></span><ChevronDown size={17} className="ml-auto shrink-0 text-slate" aria-hidden="true" /></button><button type="button" onClick={() => openProfile(activeConversation.recipient)} className="icon-button hidden sm:inline-flex" aria-label="Open chat profile"><MoreHorizontal size={18} /></button></div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-paper-dim/80 p-4 sm:p-6" aria-live="polite">
                  {threadPagination.pages > 1 && <div className="flex justify-center"><Button type="button" size="sm" variant="ghost" disabled={threadPagination.page >= threadPagination.pages} onClick={() => loadThread(activeId, threadPagination.page + 1)}>Load older messages</Button></div>}
                  {isThreadLoading ? <SkeletonCard /> : thread.length === 0 ? <div className="py-16 text-center"><MessageCircle size={24} className="mx-auto text-slate/50" aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-ink">No messages yet</p><p className="mt-1 text-xs text-slate">Send the first message in this conversation.</p></div> : <AnimatePresence initial={false}>{thread.map((message) => <MessageBubble key={message._id} message={message} actorId={actorId} editingMessageId={editingMessageId} editingBody={editingBody} messageMenuId={messageMenuId} setMessageMenuId={setMessageMenuId} setEditingMessageId={setEditingMessageId} setEditingBody={setEditingBody} setDeleteTarget={setDeleteTarget} setDeleteMode={setDeleteMode} handleEditMessage={handleEditMessage} isLoading={isMessageActionLoading} />)}</AnimatePresence>}
                </div>
                <form onSubmit={handleSend} className="border-t border-line bg-surface p-3 sm:p-4"><div className="flex items-end gap-2"><label className="sr-only" htmlFor="message-body">Message</label><textarea id="message-body" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength={MAX_BODY_LENGTH} rows={2} placeholder="Write a message…" className="field min-h-11 flex-1 resize-none rounded-2xl bg-cream py-2.5" /><Button type="submit" variant="success" icon={Send} isLoading={isSending} disabled={!draft.trim()}>Send</Button></div>{draft.length > MAX_BODY_LENGTH - 300 && <p className="mt-1 text-right text-[11px] text-slate">{draft.length.toLocaleString()} / {MAX_BODY_LENGTH.toLocaleString()}</p>}</form>
              </>}
            </section>
          </div>
        </Card>
      )}

      <Modal isOpen={isAddChatOpen} onClose={closeAddChat} title="Add chat">
        <div className="space-y-4">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-paper-dim p-1" role="tablist" aria-label="Recipient groups">
            {groups.map((group) => <button key={group.key} type="button" role="tab" aria-selected={conversationGroup === group.key} onClick={() => { setConversationGroup(group.key); setRecipientResults([]); setRecipientError(''); }} className={`min-h-10 shrink-0 rounded-xl px-3.5 text-xs font-bold transition-[background-color,color,transform] duration-160 ${conversationGroup === group.key ? 'bg-sage text-white shadow-[0_5px_14px_rgba(15,128,105,0.18)]' : 'text-slate hover:bg-paper hover:text-ink'}`}>{group.label}</button>)}
          </div>
          <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); loadRecipients(recipientQuery, conversationGroup); }}>
            <label className="sr-only" htmlFor="message-recipient-query">Search authorized recipients</label>
            <div className="directory-search min-w-0 flex-1"><Search size={17} className="directory-search-icon" aria-hidden="true" /><input id="message-recipient-query" value={recipientQuery} onChange={(event) => setRecipientQuery(event.target.value)} placeholder="Search name, email, or academic ID" autoFocus className="field directory-search-input w-full" minLength={2} /></div>
            <Button type="submit" icon={Search} disabled={recipientQuery.trim().length < 2 || isRecipientLoading} isLoading={isRecipientLoading}>Search</Button>
          </form>
          <div className="min-h-28" aria-live="polite">
            {recipientError && <div className="notice-error" role="alert">{recipientError}</div>}
            {isRecipientLoading && <SkeletonTable cols={1} rows={3} />}
            {!isRecipientLoading && !recipientError && recipientQuery.trim().length < 2 && <div className="rounded-2xl border border-dashed border-line bg-paper-dim p-6 text-center"><Search size={21} className="mx-auto text-slate/60" aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-ink">Search to find someone</p><p className="mt-1 text-xs text-slate">Only people you are authorized to message will appear.</p></div>}
            {!isRecipientLoading && !recipientError && recipientQuery.trim().length >= 2 && recipientResults.length === 0 && <div className="rounded-2xl border border-dashed border-line bg-paper-dim p-6 text-center"><p className="text-sm font-semibold text-ink">No authorized matches</p><p className="mt-1 text-xs text-slate">Try a different name, email, or academic ID.</p></div>}
            {!isRecipientLoading && recipientResults.length > 0 && <div className="max-h-80 space-y-2 overflow-y-auto">{recipientResults.map((recipient) => <div key={recipient._id} className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3"><Avatar account={recipient} size="sm" /><button type="button" onClick={() => startConversation(recipient._id)} className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"><span className="block truncate text-sm font-semibold text-ink">{displayName(recipient)}</span><span className="mt-0.5 block truncate text-xs text-slate">{recipient.isTutor ? 'Tutor' : roleLabel(recipient.role)}{recipient.class?.name ? ` · ${recipient.class.name}` : ''}</span></button><button type="button" aria-label={`View ${displayName(recipient)} profile`} onClick={() => { closeAddChat(); openProfile(recipient); }} className="icon-button shrink-0"><UserRound size={15} /></button></div>)}</div>}
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => !isMessageActionLoading && setDeleteTarget(null)} title="Delete message">
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-slate">Delete this message permanently? It will be removed from the conversation</p>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isMessageActionLoading}>Cancel</Button><Button type="button" variant="danger" icon={Trash2} onClick={handleDeleteMessage} isLoading={isMessageActionLoading}>{deleteMode === 'everyone' ? 'Delete from everyone' : 'Delete from me'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(profileTarget)} onClose={() => setProfileTarget(null)} title="Profile">
        {profileLoading && <div className="py-12 text-center text-sm text-slate">Loading profile…</div>}
        {profileError && <div className="notice-error" role="alert">{profileError}</div>}
        {!profileLoading && !profileError && profile && <MessageProfile profile={profile} />}
      </Modal>
    </motion.div>
  );
}

function MessageBubble({ message, actorId, editingMessageId, editingBody, messageMenuId, setMessageMenuId, setEditingMessageId, setEditingBody, setDeleteTarget, setDeleteMode, handleEditMessage, isLoading }) {
  const own = idString(message.sender) === idString(actorId);
  const seen = Boolean(message.readAt);
  const editing = String(editingMessageId) === String(message._id);
  const menuOpen = String(messageMenuId) === String(message._id);
  return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className={`group flex ${own ? 'justify-end' : 'justify-start'}`}>
    <div className={`relative max-w-[88%] rounded-2xl px-4 py-2.5 shadow-[0_4px_12px_rgba(16,47,66,0.06)] sm:max-w-[76%] ${own ? 'rounded-br-md bg-sage text-white' : 'rounded-bl-md border border-line bg-surface text-ink'}`}>
      {!editing && <div data-message-menu className="absolute -right-1 -top-3 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"><button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-slate shadow-sm transition-colors hover:border-accent/50 hover:text-ink" onClick={() => setMessageMenuId(menuOpen ? null : message._id)} aria-label={`Message actions for ${formatMessageTime(message.createdAt)}`} aria-expanded={menuOpen}><MoreHorizontal size={14} /></button>{menuOpen && <div data-message-menu className="absolute right-0 top-9 z-10 min-w-44 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-[0_14px_32px_rgba(16,47,66,0.16)]">{own && <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-paper-dim" onClick={() => { setEditingMessageId(message._id); setEditingBody(message.body); setMessageMenuId(null); }}><Edit3 size={14} /> Edit</button>}<button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-clay transition-colors hover:bg-clay-light" onClick={() => { setDeleteTarget(message); setDeleteMode('me'); setMessageMenuId(null); }}><Trash2 size={14} /> Delete from me</button>{own && <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-clay transition-colors hover:bg-clay-light" onClick={() => { setDeleteTarget(message); setDeleteMode('everyone'); setMessageMenuId(null); }}><Trash2 size={14} /> Delete from everyone</button>}</div>}</div>}
      {editing ? <div className="min-w-[230px] sm:min-w-[300px]"><textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} maxLength={MAX_BODY_LENGTH} rows={3} autoFocus className="w-full resize-y rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/60 focus:border-white/65 focus:outline-none focus:ring-2 focus:ring-white/20" aria-label="Edit message" /><div className="mt-2 flex justify-end gap-2"><button type="button" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10" onClick={() => { setEditingMessageId(null); setEditingBody(''); }} disabled={isLoading}><X size={13} /> Cancel</button><button type="button" className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-sage transition-colors hover:bg-white/90" onClick={() => handleEditMessage(message)} disabled={isLoading || !editingBody.trim()}>Save</button></div></div> : <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>}
      <div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${own ? 'text-white/75' : 'text-slate/70'}`}><span>{message.editedAt && 'edited · '}{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>{own && <CheckCheck size={14} className={seen ? 'text-sky-200' : 'text-white/70'} aria-label={seen ? 'Seen' : 'Sent'} />}</div>
    </div>
  </motion.div>;
}

function Avatar({ account, size = 'md' }) {
  const dimensions = size === 'sm' ? 'h-10 w-10 text-xs' : 'h-12 w-12 text-sm';
  return <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage-light font-bold text-sage ${dimensions}`}>{account?.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(account)}</span>;
}

function MessageProfile({ profile }) {
  const role = roleLabel(profile.role);
  const details = [
    ['Email', profile.email],
    ['Phone', profile.phone],
    [role === 'Student' ? 'Register number' : 'Employee ID', role === 'Student' ? profile.registerNumber : profile.employeeId],
    ['Department', profile.department?.name],
    ['Class', profile.class?.name],
    ['Semester', profile.class?.semester?.label || (profile.class?.semester?.number ? `Semester ${profile.class.semester.number}` : null)],
    ['Designation', profile.designation],
    ['Qualification', profile.qualification],
    ['Admission year', profile.admissionYear],
    ['Date of birth', profile.dateOfBirth],
    ['Age', profile.age],
    ['Last active', formatDate(profile.lastLoginAt)],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  return <div className="space-y-5"><div className="flex items-center gap-4 border-b border-line pb-5"><Avatar account={profile} /><div className="min-w-0"><h2 className="truncate text-xl font-semibold text-ink">{displayName(profile)}</h2><p className="mt-1 text-sm text-slate">{role}</p></div></div><dl className="grid gap-3 sm:grid-cols-2">{details.map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-surface px-3 py-2.5"><dt className="eyebrow">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-ink">{String(value)}</dd></div>)}</dl>{profile.assignedSubjects?.length > 0 && <ProfileList title="Assigned subjects" values={profile.assignedSubjects.map((subject) => `${subject.name}${subject.code ? ` (${subject.code})` : ''}${subject.class?.name ? ` · ${subject.class.name}` : ''}`)} />}{profile.assignedClasses?.length > 0 && <ProfileList title="Assigned classes" values={profile.assignedClasses.map((classDoc) => `${classDoc.name}${classDoc.code ? ` (${classDoc.code})` : ''} · ID ${classDoc._id}`)} />}{profile.tutorClasses?.length > 0 && <ProfileList title="Tutor classes" values={profile.tutorClasses.map((classDoc) => `${classDoc.name}${classDoc.code ? ` (${classDoc.code})` : ''} · ID ${classDoc._id}`)} />}{profile.deviceStatus && <ProfileList title="Device access" values={[profile.deviceStatus.bound ? `Approved device bound since ${formatDate(profile.deviceStatus.boundAt)}` : 'No device has been approved yet']} />}{profile.attendance?.overall && <div className="rounded-xl border border-line bg-surface p-4"><p className="eyebrow">Attendance</p><p className="mt-2 text-2xl font-semibold text-ink">{profile.attendance.overall.percentage ?? 0}%</p><p className="mt-1 text-sm text-slate">{profile.attendance.overall.present ?? 0} attended of {profile.attendance.overall.total ?? 0} recorded sessions.</p></div>}</div>;
}

function ProfileList({ title, values }) {
  return <div className="rounded-xl border border-line bg-surface p-4"><p className="eyebrow">{title}</p><ul className="mt-2 space-y-1.5 text-sm text-ink">{values.map((value) => <li key={value} className="break-words">{value}</li>)}</ul></div>;
}

