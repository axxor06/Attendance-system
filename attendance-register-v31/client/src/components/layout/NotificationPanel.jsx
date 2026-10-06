import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, RotateCcw, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getHomePath } from './navigation.js';
import { notificationApi } from '../../api/misc.js';
import Badge from '../common/Badge.jsx';
import { getFriendlyError } from '../../utils/errorMessages.js';

const TYPE_VARIANT = {
  low_attendance: 'absent', attendance_marked: 'present',
  password_changed: 'amber', otp_sent: 'neutral',
  account_created: 'present', general: 'neutral',
};

export default function NotificationPanel({ onClose, onCountChange }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await notificationApi.list({ limit: 15 });
      const nextNotifications = data?.data?.notifications;
      if (!Array.isArray(nextNotifications)) throw new Error('The notifications response did not contain a valid list.');
      setNotifications(nextNotifications);
    } catch (err) {
      setNotifications([]);
      setError(getFriendlyError(err, 'Notifications could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  async function handleMarkAllRead() {
    if (busyAction) return;
    setBusyAction('all');
    setError('');
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      onCountChange?.(0);
    } catch (err) {
      setError(getFriendlyError(err, 'Notifications could not be marked as read.'));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenNotification(notification) {
    if (notification.type !== 'message' || !notification.meta?.conversationId) return;
    if (!notification.isRead) await handleMarkRead(notification._id);
    navigate(`${getHomePath(user?.role)}/messages?conversation=${notification.meta.conversationId}`);
    onClose?.();
  }

  async function handleMarkRead(id) {
    if (busyAction) return;
    const selected = notifications.find((notification) => notification._id === id);
    if (!selected || selected.isRead) return;
    setBusyAction(id);
    setError('');
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) => prev.map((notification) => notification._id === id ? { ...notification, isRead: true } : notification));
      onCountChange?.((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(getFriendlyError(err, 'Notification could not be marked as read.'));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -4 }}
      transition={{ duration: 0.15 }}
      className="w-full overflow-hidden rounded-2xl border border-line bg-cream shadow-[0_18px_46px_rgba(35,31,82,0.15)]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-display text-sm font-semibold text-ink">Notifications</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={Boolean(busyAction)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate transition-colors hover:bg-indigo-light hover:text-indigo disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck size={13} aria-hidden="true" /> All read
          </button>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate transition-colors hover:bg-indigo-light hover:text-ink" aria-label="Close notifications">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border-b border-clay/15 bg-clay-light/55 px-4 py-3" role="alert">
          <p className="min-w-0 flex-1 text-xs leading-5 text-clay">{error}</p>
          <button type="button" onClick={loadNotifications} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-clay transition-colors hover:bg-clay-light" aria-label="Retry loading notifications">
            <RotateCcw size={12} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 px-4 py-5" aria-label="Loading notifications" aria-busy="true">
            <div className="h-3 w-24 animate-pulse rounded bg-indigo/10" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-indigo/10" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-indigo/10" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-light text-indigo"><Bell size={20} aria-hidden="true" /></div>
            <p className="text-sm text-slate">You're all caught up.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification._id}
              onClick={() => handleOpenNotification(notification)}
              className={`flex gap-2.5 border-b border-line px-4 py-3 last:border-0 ${notification.type === 'message' ? 'cursor-pointer hover:bg-indigo-light/60' : ''} ${notification.isRead ? 'opacity-65' : 'bg-amber/5'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={TYPE_VARIANT[notification.type] || 'neutral'} className="text-[10px]">
                    {notification.type.replace(/_/g, ' ')}
                  </Badge>
                  {!notification.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" aria-label="Unread" />}
                </div>
                <p className="truncate text-sm font-medium text-ink">{notification.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate">{notification.message}</p>
                <p className="mt-1 text-[11px] text-slate/60">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </p>
              </div>
              {!notification.isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(notification._id)}
                  disabled={Boolean(busyAction)}
                  className="shrink-0 self-start rounded-lg p-1.5 text-slate transition-colors hover:bg-indigo-light hover:text-indigo disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Mark notification as read: ${notification.title}`}
                >
                  <Check size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
