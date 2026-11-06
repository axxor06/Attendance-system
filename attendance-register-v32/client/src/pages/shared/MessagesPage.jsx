import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { messagesApi } from '../../api/messages.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { requestBadgeRefresh } from '../../context/BadgeContext.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import ConversationList from '../../components/messages/ConversationList.jsx';
import MessageThread from '../../components/messages/MessageThread.jsx';
import NewMessageDialog from '../../components/messages/NewMessageDialog.jsx';
import MessageProfile from '../../components/messages/MessageProfile.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';
import { createClientMessageId, mergeConversations, mergeMessages } from '../../utils/messageThread.js';
import { GROUPS_BY_ROLE, normalizeRole } from '../../utils/messagingRoles.js';

const THREAD_PAGE = 30;
const CONVERSATION_PAGE = 20;
const idString = (value) => value?._id?.toString?.() || value?.toString?.() || '';

export default function MessagesPage() {
  const { user } = useAuth();
  const actorId = user?._id || user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('conversation') || '';
  const groups = GROUPS_BY_ROLE[normalizeRole(user?.role)] || GROUPS_BY_ROLE.user;

  const [conversations, setConversations] = useState([]);
  const [conversationPage, setConversationPage] = useState({ page: 0, pages: 1 });
  const [listLoading, setListLoading] = useState(true);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [listError, setListError] = useState('');
  const [openedConversation, setOpenedConversation] = useState(null); // opened but not yet in the list (no messages sent)

  const [thread, setThread] = useState({ messages: [], hasMore: false, nextBefore: null });
  const [threadLoading, setThreadLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [scrollSignal, setScrollSignal] = useState(0);

  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const pendingSend = useRef(null); // { body, clientMessageId } kept across retries so a retry is idempotent

  const [newOpen, setNewOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const threadRequest = useRef(0);

  const activeConversation = useMemo(
    () => conversations.find((c) => String(c._id) === String(activeId)) || (openedConversation && String(openedConversation._id) === String(activeId) ? openedConversation : null),
    [conversations, activeId, openedConversation],
  );

  const selectConversation = useCallback((id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('conversation', id); else next.delete('conversation');
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  // ----- conversation list -------------------------------------------------------------------
  const loadConversations = useCallback(async (page = 1, { silent = false } = {}) => {
    if (page === 1 && !silent) setListLoading(true);
    if (page > 1) setListLoadingMore(true);
    if (!silent) setListError('');
    try {
      const { data } = await messagesApi.conversations({ page, limit: CONVERSATION_PAGE });
      const next = data?.data?.conversations;
      if (!Array.isArray(next)) throw new Error('Invalid conversation list.');
      setConversations((current) => mergeConversations(page === 1 && !silent ? [] : current, next));
      if (page > 1 || !silent) setConversationPage({ page, pages: data?.data?.pagination?.pages || 1 });
    } catch (error) {
      if (!silent) { setConversations([]); setListError(getFriendlyError(error, 'Conversations could not be loaded.')); }
    } finally { setListLoading(false); setListLoadingMore(false); }
  }, []);

  useEffect(() => { loadConversations(1); }, [loadConversations]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') loadConversations(1, { silent: true }); }, 20000);
    return () => clearInterval(timer);
  }, [loadConversations]);

  // ----- active thread -------------------------------------------------------------------------
  const markReadIfNeeded = useCallback(async (conversationId, messages) => {
    if (!messages.some((m) => idString(m.recipient) === idString(actorId) && !m.readAt)) return;
    try {
      await messagesApi.markRead(conversationId);
      setConversations((current) => current.map((c) => (String(c._id) === String(conversationId) ? { ...c, unreadCount: 0 } : c)));
      requestBadgeRefresh();
    } catch { /* read state is retried on the next poll */ }
  }, [actorId]);

  const loadThread = useCallback(async () => {
    if (!activeId) { setThread({ messages: [], hasMore: false, nextBefore: null }); return; }
    const requestId = ++threadRequest.current;
    setThreadLoading(true);
    setThreadError('');
    try {
      const { data } = await messagesApi.messages(activeId, { limit: THREAD_PAGE });
      if (requestId !== threadRequest.current) return;
      const messages = data?.data?.messages || [];
      setThread({ messages, hasMore: Boolean(data?.data?.hasMore), nextBefore: data?.data?.nextBefore || null });
      setScrollSignal((n) => n + 1);
      markReadIfNeeded(activeId, messages);
    } catch (error) {
      if (requestId !== threadRequest.current) return;
      setThread({ messages: [], hasMore: false, nextBefore: null });
      setThreadError(getFriendlyError(error, 'This conversation could not be loaded.'));
    } finally { if (requestId === threadRequest.current) setThreadLoading(false); }
  }, [activeId, markReadIfNeeded]);

  useEffect(() => { setEditingId(null); setSendError(''); pendingSend.current = null; setDraft(''); loadThread(); }, [loadThread]);

  // Newest messages only: merge into what is already on screen, never replace older pages.
  useEffect(() => {
    if (!activeId) return undefined;
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data } = await messagesApi.messages(activeId, { limit: THREAD_PAGE });
        const latest = data?.data?.messages || [];
        setThread((current) => ({ ...current, messages: mergeMessages(current.messages, latest) }));
        markReadIfNeeded(activeId, latest);
      } catch { /* the next poll will retry */ }
    }, 10000);
    return () => clearInterval(timer);
  }, [activeId, markReadIfNeeded]);

  async function loadOlder() {
    if (!thread.nextBefore || olderLoading) return;
    setOlderLoading(true);
    try {
      const { data } = await messagesApi.messages(activeId, { limit: THREAD_PAGE, before: thread.nextBefore });
      setThread((current) => ({ messages: mergeMessages(current.messages, data?.data?.messages || []), hasMore: Boolean(data?.data?.hasMore), nextBefore: data?.data?.nextBefore || null }));
    } catch (error) {
      toast.error(getFriendlyError(error, 'Earlier messages could not be loaded.'));
    } finally { setOlderLoading(false); }
  }

  async function handleSend() {
    const body = draft.trim();
    if (!activeId || !body || isSending) return;
    // Same text re-sent after a failure keeps its key, so the server stores it once.
    if (!pendingSend.current || pendingSend.current.body !== body) pendingSend.current = { body, clientMessageId: createClientMessageId() };
    setIsSending(true);
    setSendError('');
    try {
      const { data } = await messagesApi.send(activeId, { body, clientMessageId: pendingSend.current.clientMessageId });
      const sent = data?.data?.message;
      if (!sent?._id) throw new Error('Invalid response.');
      pendingSend.current = null;
      setThread((current) => ({ ...current, messages: mergeMessages(current.messages, [sent]) }));
      stickToBottom();
      setDraft('');
      setOpenedConversation((current) => current);
      loadConversations(1, { silent: true });
    } catch (error) {
      setSendError(getFriendlyError(error, 'Your message was not sent. Check your connection and try again.'));
    } finally { setIsSending(false); }
  }

  function stickToBottom() { setScrollSignal((n) => n + 1); }

  async function handleSaveEdit(message) {
    const body = editingBody.trim();
    if (!body || actionBusy) return;
    setActionBusy(true);
    try {
      const { data } = await messagesApi.edit(activeId, message._id, { body });
      const edited = data?.data?.message;
      setThread((current) => ({ ...current, messages: mergeMessages(current.messages, [edited]) }));
      setEditingId(null);
      loadConversations(1, { silent: true });
    } catch (error) { toast.error(getFriendlyError(error, 'The message could not be edited.')); } finally { setActionBusy(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || actionBusy) return;
    setActionBusy(true);
    try {
      await messagesApi.remove(activeId, deleteTarget.message._id, deleteTarget.mode);
      setThread((current) => ({ ...current, messages: current.messages.filter((m) => m._id !== deleteTarget.message._id) }));
      toast.success(deleteTarget.mode === 'everyone' ? 'Message deleted for everyone.' : 'Message deleted for you.');
      setDeleteTarget(null);
      loadConversations(1, { silent: true });
    } catch (error) { toast.error(getFriendlyError(error, 'The message could not be deleted.')); } finally { setActionBusy(false); }
  }

  async function startConversation(recipient) {
    try {
      const { data } = await messagesApi.createConversation(recipient._id);
      const conversation = data?.data?.conversation;
      if (!conversation?._id) throw new Error('Invalid response.');
      setOpenedConversation(conversation);
      setNewOpen(false);
      selectConversation(conversation._id);
    } catch (error) { toast.error(getFriendlyError(error, 'That conversation could not be started.')); }
  }

  // ----- profile -------------------------------------------------------------------------------
  useEffect(() => {
    if (!profileId) { setProfile(null); setProfileError(''); return undefined; }
    let active = true;
    setProfileLoading(true);
    setProfileError('');
    messagesApi.profile(profileId)
      .then(({ data }) => { if (active) setProfile(data?.data?.profile || null); })
      .catch((error) => { if (active) setProfileError(getFriendlyError(error, 'Profile details could not be loaded.')); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [profileId]);

  const showThreadOnMobile = Boolean(activeId);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div><h1 className="page-title">Messages</h1><p className="page-lede mt-1">Private conversations with people connected to your classes.</p></div>
      </header>

      <div className="grid h-[calc(100dvh-13rem)] min-h-[28rem] grid-cols-1 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[22rem_minmax(0,1fr)] lg:divide-x lg:divide-line">
        <div className={showThreadOnMobile ? 'hidden min-h-0 lg:flex lg:flex-col' : 'flex min-h-0 flex-col'}>
          <ConversationList
            conversations={conversations} activeId={activeId} isLoading={listLoading} error={listError}
            hasMore={conversationPage.page < conversationPage.pages} isLoadingMore={listLoadingMore}
            onSelect={selectConversation} onNewMessage={() => setNewOpen(true)}
            onLoadMore={() => loadConversations(conversationPage.page + 1)} onRetry={() => loadConversations(1)}
          />
        </div>
        <div className={showThreadOnMobile ? 'flex min-h-0 flex-col' : 'hidden min-h-0 lg:flex lg:flex-col'}>
          <MessageThread
            conversation={activeConversation} actorId={actorId} messages={thread.messages} hasMore={thread.hasMore}
            isLoading={threadLoading} isLoadingOlder={olderLoading} error={threadError} scrollSignal={scrollSignal}
            draft={draft} setDraft={(value) => { setDraft(value); if (sendError) setSendError(''); }} isSending={isSending} sendError={sendError}
            onSend={handleSend} onLoadOlder={loadOlder} onRetry={loadThread} onBack={() => selectConversation('')}
            onOpenProfile={(account) => setProfileId(idString(account))}
            editingId={editingId} editingBody={editingBody} setEditingBody={setEditingBody}
            onStartEdit={(message) => { setEditingId(message._id); setEditingBody(message.body); }} onCancelEdit={() => setEditingId(null)}
            onSaveEdit={handleSaveEdit} onDelete={(message, mode) => setDeleteTarget({ message, mode })} actionBusy={actionBusy}
          />
        </div>
      </div>

      <NewMessageDialog isOpen={newOpen} onClose={() => setNewOpen(false)} groups={groups} onStart={startConversation} />

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => !actionBusy && setDeleteTarget(null)} title="Delete message">
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-slate">{deleteTarget?.mode === 'everyone' ? 'This message will be removed for you and for the other person. This cannot be undone.' : 'This message will be removed from your view only. The other person will still see it.'}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={actionBusy}>Cancel</Button>
            <Button type="button" variant="danger" icon={Trash2} onClick={handleDelete} isLoading={actionBusy}>{deleteTarget?.mode === 'everyone' ? 'Delete for everyone' : 'Delete for me'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(profileId)} onClose={() => setProfileId('')} title="Profile" maxWidth="max-w-xl">
        {profileLoading && <div className="py-12 text-center text-sm text-slate">Loading profile…</div>}
        {profileError && <div className="notice-error" role="alert">{profileError}</div>}
        {!profileLoading && !profileError && profile && <MessageProfile profile={profile} />}
      </Modal>
    </div>
  );
}
