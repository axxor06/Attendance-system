/* eslint-disable react-refresh/only-export-components -- hook and provider share one module */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { notificationApi } from '../api/misc.js';
import { useAuth } from './AuthContext.jsx';

/**
 * Sidebar badge counts, always read from the database.
 *
 * Two numbers are kept strictly apart:
 *   - pendingRegistrations: requests still awaiting a decision (HOD only)
 *   - unreadNotifications:  notifications the user has not read
 * Reading a notification never changes the first; approving or rejecting a
 * request changes the first immediately via refreshBadges().
 *
 * There is no WebSocket/SSE layer in this project, so counts are refreshed by a
 * small visibility-aware poll plus an immediate refresh whenever the user acts
 * or returns to the tab. Polling is jittered so thousands of students do not
 * hit the API in the same second.
 */

export const BADGE_REFRESH_EVENT = 'ar:badges-refresh';
const POLL_MS = { super_admin: 20000, admin: 45000, user: 60000 };

const EMPTY = { unreadNotifications: 0, unreadMessages: 0, pendingRegistrations: null, registrations: null };
const BadgeContext = createContext({ ...EMPTY, loaded: false, refreshBadges: () => {} });

/** Fire from anywhere (e.g. after approving a request) to refresh the badges now. */
export function requestBadgeRefresh() {
  window.dispatchEvent(new Event(BADGE_REFRESH_EVENT));
}

export function BadgeProvider({ children }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id || null;
  const role = user?.role;
  const [counts, setCounts] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const inFlight = useRef(null);

  const refreshBadges = useCallback(async () => {
    if (!userId) return;
    if (inFlight.current) return inFlight.current;
    inFlight.current = notificationApi.summary()
      .then(({ data }) => {
        const next = data?.data || {};
        setCounts({
          unreadNotifications: Number(next.unreadNotifications) || 0,
          unreadMessages: Number(next.unreadMessages) || 0,
          pendingRegistrations: next.pendingRegistrations ?? null,
          registrations: next.registrations ?? null,
        });
        setLoaded(true);
      })
      .catch(() => { /* badges are non-critical; keep the last known numbers */ })
      .finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setCounts(EMPTY);
      setLoaded(false);
      return undefined;
    }
    refreshBadges();
    const base = POLL_MS[role] || 60000;
    let timer;
    const schedule = () => {
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await refreshBadges();
        schedule();
      }, base + Math.random() * base * 0.2);
    };
    schedule();
    const onWake = () => { if (document.visibilityState === 'visible') refreshBadges(); };
    window.addEventListener(BADGE_REFRESH_EVENT, refreshBadges);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(BADGE_REFRESH_EVENT, refreshBadges);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [userId, role, refreshBadges]);

  const value = useMemo(() => ({ ...counts, loaded, refreshBadges }), [counts, loaded, refreshBadges]);
  return <BadgeContext.Provider value={value}>{children}</BadgeContext.Provider>;
}

export function useBadges() {
  return useContext(BadgeContext);
}
