import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { notificationApi } from '../../api/misc.js';
import Badge from '../common/Badge.jsx';

const TYPE_VARIANT = {
  low_attendance: 'absent', attendance_marked: 'present',
  password_changed: 'amber', otp_sent: 'neutral',
  account_created: 'present', general: 'neutral',
};

export default function NotificationPanel({ onClose, onCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    notificationApi.list({ limit: 15 }).then(({ data }) => {
      setNotifications(data.data.notifications);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  async function handleMarkAllRead() {
    await notificationApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    onCountChange(0);
  }

  async function handleMarkRead(id) {
    await notificationApi.markRead(id);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    onCountChange(c => Math.max(0, c - 1));
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-full overflow-hidden border border-ink/10 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-ink/8 px-4 py-3">
        <p className="font-display text-sm font-semibold text-ink">Notifications</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs font-medium text-ink/50 hover:text-ink transition-colors"
          >
            <CheckCheck size={13} /> All read
          </button>
          <button onClick={onClose} className="rounded-lg p-1 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-slate">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8">
            <Bell size={22} className="text-ink/20" />
            <p className="text-sm text-slate">You're all caught up.</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n._id}
              className={`flex gap-2.5 border-b border-ink/5 px-4 py-3 last:border-0 ${
                n.isRead ? 'opacity-60' : 'bg-amber/3'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={TYPE_VARIANT[n.type] || 'neutral'} className="text-[10px]">
                    {n.type.replace(/_/g, ' ')}
                  </Badge>
                  {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-amber shrink-0" />}
                </div>
                <p className="text-sm font-medium text-ink truncate">{n.title}</p>
                <p className="mt-0.5 text-xs text-slate line-clamp-2">{n.message}</p>
                <p className="mt-1 text-[11px] text-slate/60">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => handleMarkRead(n._id)}
                  className="self-start shrink-0 rounded-lg p-1.5 text-ink/30 hover:bg-ink/5 hover:text-ink"
                >
                  <Check size={13} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
