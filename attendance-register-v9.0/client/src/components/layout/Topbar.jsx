import { useEffect, useRef, useState } from 'react';
import { Search, Bell, Menu, User, KeyRound, ChevronDown, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext.jsx';
import { searchApi, notificationApi } from '../../api/misc.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import NotificationPanel from './NotificationPanel.jsx';
import SearchResultsPanel from './SearchResultsPanel.jsx';
import PortalPopover from '../common/PortalPopover.jsx';
import ChangePasswordModal from '../common/ChangePasswordModal.jsx';
import { ROLE_LABELS } from './navigation.js';

const ROLE_COLORS = {
  super_admin: 'bg-clay text-white',
  admin: 'bg-ink text-paper',
  hod: 'bg-ink text-amber',
  faculty: 'bg-amber/20 text-ink',
  student: 'bg-sage/20 text-sage',
};

export default function Topbar({ onOpenMobileNav }) {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [searchResults, setSearchResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const canSearch = ['super_admin', 'admin', 'hod', 'faculty'].includes(user?.role);

  useEffect(() => {
    if (!canSearch) return undefined;
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [canSearch]);

  useEffect(() => {
    if (!canSearch || debouncedQuery.trim().length < 2) {
      setSearchResults(null);
      return undefined;
    }
    let active = true;
    searchApi.global(debouncedQuery)
      .then(({ data }) => { if (active) setSearchResults(data.data); })
      .catch(() => { if (active) setSearchResults(null); });
    return () => { active = false; };
  }, [debouncedQuery, canSearch]);

  useEffect(() => {
    let mounted = true;
    async function loadUnread() {
      try {
        const { data } = await notificationApi.list({ limit: 1 });
        if (mounted) setUnreadCount(data.data.unreadCount || 0);
      } catch { /* notifications are non-critical */ }
    }
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  async function handleLogout() {
    setProfileOpen(false);
    await logout();
  }

  const profileBase = ['super_admin', 'admin', 'hod'].includes(user?.role) ? '/hod' : `/${user?.role}`;
  const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="relative z-20 flex min-h-[76px] items-center gap-3 glass-subtle border-x-0 border-b border-white/65 bg-white/42 px-4 shadow-[0_12px_30px_rgba(22,43,73,0.06)] backdrop-blur-xl lg:px-7">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-xl p-2.5 text-slate transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {canSearch ? (
        <div ref={searchRef} className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate/60" />
          <input
            ref={searchInputRef}
            value={query}
            onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search people, classes, subjects"
            className="min-h-11 w-full rounded-[14px] border border-ink/10 bg-white/48 py-2.5 pl-9 pr-3 text-sm text-ink shadow-[0_3px_12px_rgba(22,43,73,0.04)] placeholder:text-slate/50 transition-[border-color,box-shadow,background-color] focus:border-amber focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber/10"
          />
          <PortalPopover
            anchorRef={searchRef}
            isOpen={searchOpen && query.trim().length >= 2}
            onClose={() => setSearchOpen(false)}
            width={420}
            align="start"
            role="listbox"
          >
            <SearchResultsPanel results={searchResults} onClose={() => setSearchOpen(false)} />
          </PortalPopover>
        </div>
      ) : <div className="flex-1" />}

      <div ref={notifRef}>
        <button
          type="button"
          onClick={() => { setNotifOpen((current) => !current); setProfileOpen(false); }}
          className="relative rounded-xl p-2.5 text-slate transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          aria-label="Notifications"
          aria-expanded={notifOpen}
        >
          <Bell size={18} />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <PortalPopover anchorRef={notifRef} isOpen={notifOpen} onClose={() => setNotifOpen(false)} width={380}>
          <NotificationPanel onCountChange={setUnreadCount} onClose={() => setNotifOpen(false)} />
        </PortalPopover>
      </div>

      <div ref={profileRef}>
        <button
          type="button"
          onClick={() => { setProfileOpen((current) => !current); setNotifOpen(false); }}
          className="flex items-center gap-2 rounded-xl border-l border-ink/10 pl-3 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          aria-expanded={profileOpen}
          aria-label="Open profile menu"
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold shadow-sm ${ROLE_COLORS[user?.role] || 'bg-ink/10 text-ink'}`}>
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="max-w-[140px] truncate text-xs font-semibold leading-tight text-ink">{user?.name}</p>
            <p className="text-[10px] leading-tight text-slate">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
          <ChevronDown size={13} className={`hidden text-slate transition-transform duration-200 sm:block ${profileOpen ? 'rotate-180' : ''}`} />
        </button>
        <PortalPopover anchorRef={profileRef} isOpen={profileOpen} onClose={() => setProfileOpen(false)} width={280}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden border border-ink/10 bg-paper shadow-xl"
          >
            <div className="border-b border-ink/10 px-4 py-3">
              <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-xs text-slate">{user?.email}</p>
            </div>
            <div className="p-1.5">
              <Link to={`${profileBase}/profile`} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink/80 transition-colors hover:bg-ink/5">
                <User size={15} /> My profile
              </Link>
              <button
                type="button"
                onClick={() => { setProfileOpen(false); setPasswordOpen(true); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink/80 transition-colors hover:bg-ink/5"
              >
                <KeyRound size={15} /> Change password
              </button>
            </div>
            <div className="border-t border-ink/10 p-1.5">
              <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-clay transition-colors hover:bg-clay-light">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </motion.div>
        </PortalPopover>
      </div>
      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  );
}
