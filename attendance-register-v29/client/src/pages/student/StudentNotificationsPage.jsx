import { getFriendlyError } from '../../utils/errorMessages.js';
import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationApi } from '../../api/misc.js';
import Card from '../../components/common/Card.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import { fadeUp, staggerContainer, staggerItem } from '../../utils/motion.js';

const TYPE_VARIANT = {
  low_attendance: 'absent', attendance_marked: 'present',
  password_changed: 'amber', otp_sent: 'neutral',
  account_created: 'present', general: 'neutral',
};

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data } = await notificationApi.list({ page, limit: 25 });
      const nextNotifications = data?.data?.notifications;
      if (!Array.isArray(nextNotifications)) throw new Error('The notifications response did not contain a valid list.');
      setNotifications(nextNotifications);
      setUnreadCount(data?.data?.unreadCount || 0);
      setPagination(data?.data?.pagination || { page, pages: 1, total: nextNotifications.length, limit: 25 });
    } catch (err) {
      setNotifications([]);
      setUnreadCount(0);
      setPagination({ page, pages: 1, total: 0, limit: 25 });
      setLoadError(getFriendlyError(err, 'Page could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error(getFriendlyError(err, 'Could not mark notifications as read.'));
    }
  }

  async function handleDelete(id) {
    try {
      await notificationApi.remove(id);
      const removed = notifications.find((notification) => notification._id === id);
      setNotifications((prev) => prev.filter((notification) => notification._id !== id));
      if (removed && !removed.isRead) setUnreadCount((count) => Math.max(0, count - 1));
      if (notifications.length === 1 && page > 1) setPage((current) => current - 1);
    } catch (err) {
      toast.error(getFriendlyError(err, 'Could not delete notification.'));
    }
  }

  return (
    <motion.div className="flex flex-col gap-6" {...fadeUp}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-slate">Updates about your attendance and account</p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" icon={CheckCheck} onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {unreadCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-2xl bg-amber/10 px-4 py-3"
        >
          <div className="h-2 w-2 rounded-full bg-amber animate-ping-slow" />
          <p className="text-sm font-medium text-amber">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </motion.div>
      )}

      {isLoading ? (
        <SkeletonTable cols={1} rows={6} />
      ) : loadError ? (
        <Card className="border-clay/20 bg-clay-light/60 p-6" role="alert">
          <p className="font-semibold text-clay">Page could not be loaded.</p>
          <p className="mt-1 text-sm text-clay/80">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={load}>Try again</Button>
        </Card>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" message="New notifications will appear here." />
      ) : (
        <Card>
          <motion.div
            className="divide-y divide-ink/5"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <AnimatePresence>
              {notifications.map((n) => (
                <motion.div
                  key={n._id}
                  variants={staggerItem}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className={`flex gap-3 px-5 py-4 transition-colors ${
                    !n.isRead ? 'bg-amber/5' : ''
                  }`}
                >
                  {!n.isRead && (
                    <div className="mt-1.5 flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-amber" />
                    </div>
                  )}
                  <div className={`flex-1 ${n.isRead ? 'pl-5' : ''}`}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Badge variant={TYPE_VARIANT[n.type] || 'neutral'}>
                        {n.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className={`text-sm font-medium ${n.isRead ? 'text-ink/70' : 'text-ink'}`}>{n.title}</p>
                    <p className="mt-0.5 text-sm text-slate">{n.message}</p>
                    <p className="mt-1.5 text-xs text-slate/60">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete notification: ${n.title}`}
                    onClick={() => handleDelete(n._id)}
                    className="ml-2 self-start rounded-lg p-1.5 text-ink/30 hover:bg-clay-light hover:text-clay transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </Card>
      )}

      {!isLoading && !loadError && notifications.length > 0 && pagination.pages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate" aria-label="Notification history pagination">
          <p>Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
            <span className="min-w-16 text-center text-xs font-semibold text-ink">Page {pagination.page} of {pagination.pages}</span>
            <Button type="button" variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}>Next</Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
