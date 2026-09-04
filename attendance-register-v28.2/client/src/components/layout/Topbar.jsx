import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, KeyRound, LogOut, Menu, Monitor, Moon, Search, Settings, Sun, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { searchApi, notificationApi } from '../../api/misc.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import NotificationPanel from './NotificationPanel.jsx';
import SearchResultsPanel from './SearchResultsPanel.jsx';
import PortalPopover from '../common/PortalPopover.jsx';
import ChangePasswordModal from '../common/ChangePasswordModal.jsx';
import { canonicalRole, getProfileBase, ROLE_LABELS } from './navigation.js';
import { requestSingleFlight } from '../../utils/requestSingleFlight.js';

export default function Topbar({ onOpenMobileNav }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [searchResults, setSearchResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const userRole = canonicalRole(user?.role);
  const canSearch = ['super_admin', 'admin'].includes(userRole);
  const profileBase = getProfileBase(userRole);
  const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const departmentLabel = typeof user?.department === 'object'
    ? (user.department?.name || user.department?.code || '')
    : (user?.departmentName || user?.department || '');

  useEffect(() => setAvatarFailed(false), [user?.avatarUrl]);

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
    const controller = new AbortController();
    let active = true;
    searchApi.global(debouncedQuery, { signal: controller.signal })
      .then(({ data }) => { if (active) setSearchResults(data.data); })
      .catch((error) => {
        if (active && error?.code !== 'ERR_CANCELED' && error?.name !== 'CanceledError') setSearchResults(null);
      });
    return () => { active = false; controller.abort(); };
  }, [debouncedQuery, canSearch]);

  useEffect(() => {
    let mounted = true;
    async function loadUnread() {
      if (document.visibilityState === 'hidden') return;
      try {
        const { data } = await requestSingleFlight(`notifications-unread:${user?._id || user?.id || 'current'}`, () => notificationApi.list({ limit: 1 }));
        if (mounted) setUnreadCount(data.data.unreadCount || 0);
      } catch { /* notifications are non-critical */ }
    }
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadUnread(); };
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?._id, user?.id]);

  async function handleLogout() {
    setProfileOpen(false);
    try {
      await logout();
      toast.success('You have been signed out.');
    } catch {
      toast.error('Signed out locally. Please close any other active tabs.');
    }
  }

  return (
    <header className="relative z-20 flex min-h-[76px] items-center gap-3 border-b border-line/80 bg-cream/95 px-4 shadow-[0_5px_22px_rgba(16,47,66,0.07)] backdrop-blur-sm lg:px-7">
      <button type="button" onClick={onOpenMobileNav} className="icon-button border-transparent bg-transparent p-2.5 hover:border-line hover:bg-indigo-light hover:text-ink focus-visible:ring-accent lg:hidden" aria-label="Open navigation">
        <Menu size={20} />
      </button>
      <div className="mr-1 min-w-0 lg:hidden">
        <p className="truncate font-display text-sm font-semibold text-ink">Attendance Register</p>
        <p className="eyebrow mt-1 text-[9px] text-slate/65">Academic operations</p>
      </div>
      {canSearch ? (
        <div ref={searchRef} className="global-search relative flex-1 max-w-xl">
          <Search size={16} className="global-search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            value={query}
            onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search people, classes, subjects"
            className="global-search-input field w-full border-line text-sm shadow-none placeholder:text-slate/55 focus:bg-cream"
          />
          <PortalPopover anchorRef={searchRef} isOpen={searchOpen && query.trim().length >= 2} onClose={() => setSearchOpen(false)} width={420} align="start" role="listbox">
            <SearchResultsPanel results={searchResults} onClose={() => setSearchOpen(false)} />
          </PortalPopover>
        </div>
      ) : <div className="flex-1" />}
      <div ref={notifRef}>
        <button type="button" onClick={() => { setNotifOpen((current) => !current); setProfileOpen(false); }} className="icon-button relative border-transparent bg-transparent p-2.5 hover:border-line hover:bg-indigo-light hover:text-ink focus-visible:ring-accent" aria-label="Notifications" aria-expanded={notifOpen}>
          <Bell size={18} />
          <AnimatePresence>
            {unreadCount > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</motion.span>}
          </AnimatePresence>
        </button>
        <PortalPopover anchorRef={notifRef} isOpen={notifOpen} onClose={() => setNotifOpen(false)} width={380}>
          <NotificationPanel onCountChange={setUnreadCount} onClose={() => setNotifOpen(false)} />
        </PortalPopover>
      </div>
      <div ref={profileRef} className="ml-auto">
        <button type="button" onClick={() => { setProfileOpen((current) => !current); setNotifOpen(false); }} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition-[background-color,transform] duration-160 hover:bg-paper-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-expanded={profileOpen} aria-label="Open profile menu">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-amber font-display text-[11px] font-bold text-ink shadow-[0_4px_12px_rgba(185,130,69,0.18)]">
            {user?.avatarUrl && !avatarFailed ? <img src={user.avatarUrl} alt={`${user?.name || 'User'} profile`} className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} /> : initials}
          </div>
          <div className="hidden max-w-[170px] text-left sm:block"><p className="truncate text-xs font-semibold leading-tight text-ink">{user?.name || 'Account'}</p><p className="truncate text-[10px] leading-tight text-slate">{ROLE_LABELS[userRole] || 'Account'}</p>{departmentLabel && <p className="truncate text-[9px] leading-tight text-slate/70">{departmentLabel}</p>}</div>
          <ChevronDown size={14} className={`hidden text-slate transition-transform duration-180 sm:block ${profileOpen ? 'rotate-180' : ''}`} />
        </button>
        <PortalPopover anchorRef={profileRef} isOpen={profileOpen} onClose={() => setProfileOpen(false)} width={280}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -4 }} transition={{ duration: 0.16 }} className="overflow-hidden rounded-xl border border-line bg-cream shadow-[0_18px_44px_rgba(79,70,165,0.17)]">
            <div className="border-b border-line px-4 py-3"><p className="truncate text-sm font-semibold text-ink">{user?.name || 'Account'}</p><p className="truncate text-xs text-slate">{ROLE_LABELS[userRole] || 'Account'}</p>{departmentLabel && <p className="mt-0.5 truncate text-[11px] text-slate/75">{departmentLabel}</p>}</div>
            <div className="p-1.5">
              <Link to={`${profileBase}/profile`} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink/80 transition-colors hover:bg-paper-dim"><UserRound size={15} /> Profile</Link>
              <Link to={`${profileBase}/profile#settings`} onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink/80 transition-colors hover:bg-paper-dim"><Settings size={15} /> Settings</Link>
              <button type="button" onClick={() => setThemeOpen((current) => !current)} className="flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink/80 transition-colors hover:bg-paper-dim"><span className="flex items-center gap-2.5"><Sun size={15} /> Theme</span><ChevronDown size={13} className={`text-slate transition-transform ${themeOpen ? 'rotate-180' : ''}`} /></button>
              <AnimatePresence initial={false}>
                {themeOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-1 pb-1"><div className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
                  {[['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]].map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setTheme(value)} className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-semibold transition-colors ${theme === value ? 'bg-indigo text-white' : 'text-slate hover:bg-indigo-light hover:text-ink'}`}><Icon size={14} />{label}</button>)}
                </div></motion.div>}
              </AnimatePresence>
              <button type="button" onClick={() => { setProfileOpen(false); setPasswordOpen(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink/80 transition-colors hover:bg-paper-dim"><KeyRound size={15} /> Change password</button>
            </div>
            <div className="border-t border-line p-1.5"><button type="button" onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-clay transition-colors hover:bg-clay-light"><LogOut size={15} /> Sign out</button></div>
          </motion.div>
        </PortalPopover>
      </div>
      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </header>
  );
}
