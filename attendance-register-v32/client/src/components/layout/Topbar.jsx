
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, KeyRound, LogOut, Menu, Monitor, Moon, Search, Settings, Sun, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { searchApi } from '../../api/misc.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import NotificationPanel from './NotificationPanel.jsx';
import SearchResultsPanel from './SearchResultsPanel.jsx';
import PortalPopover from '../common/PortalPopover.jsx';
import ChangePasswordModal from '../common/ChangePasswordModal.jsx';
import { canonicalRole, getProfileBase, ROLE_LABELS } from './navigation.js';
import CountBadge from '../common/CountBadge.jsx';
import { useBadges } from '../../context/BadgeContext.jsx';

export default function Topbar({ onOpenMobileNav }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [searchResults, setSearchResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { unreadNotifications: unreadCount, refreshBadges } = useBadges();
  const [avatarFailed, setAvatarFailed] = useState(false);

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
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
    if (!mobileSearchOpen) return;
    mobileSearchInputRef.current?.focus();
  }, [mobileSearchOpen]);

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
      .then(({ data }) => {
        if (active) setSearchResults(data.data);
      })
      .catch(() => {
        if (active) setSearchResults(null);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, canSearch]);

  async function handleLogout() {
    setProfileOpen(false);

    try {
      await logout();
      toast.success('You have been signed out.');
    } catch {
      toast.error('Signed out locally. Please close any other active tabs.');
    }
  }

  function handleMobileSearchToggle() {
    if (mobileSearchOpen) {
      setMobileSearchOpen(false);
      setSearchOpen(false);
    } else {
      setMobileSearchOpen(true);
      setSearchOpen(true);
      setNotifOpen(false);
      setProfileOpen(false);
    }
  }

  function closeMobileSearch() {
    setMobileSearchOpen(false);
    setSearchOpen(false);
  }

  return (
    <header className="relative z-20 flex min-h-[68px] flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 elevate-sm lg:flex-nowrap lg:px-6 lg:py-0">

      {/* Mobile Navigation */}
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-light transition-colors hover:bg-paper-dim hover:text-ink lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Mobile App Title */}
      <div className="mr-auto min-w-0 lg:hidden">
        <p className="max-w-[115px] truncate font-display text-sm font-semibold text-ink sm:max-w-none">
          Attendance Register
        </p>
      </div>

      {/* Desktop Search */}
      <div className="hidden min-w-0 flex-1 items-center lg:flex">
        {canSearch ? (
          <div ref={searchRef} className="global-search relative w-full max-w-md">
            <Search size={16} className="global-search-icon" aria-hidden="true" />

            <input
              ref={searchInputRef}
              value={query}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchOpen(false);
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search people, classes, subjects"
              className="global-search-input field w-full border-line bg-paper text-sm shadow-none placeholder:text-slate/55 focus:bg-surface"
            />

            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-slate/70 sm:block">
              ⌘K
            </kbd>

            <PortalPopover
              anchorRef={searchRef}
              isOpen={searchOpen && query.trim().length >= 2}
              onClose={() => setSearchOpen(false)}
              width={420}
              align="start"
              role="listbox"
            >
              <SearchResultsPanel
                results={searchResults}
                onClose={() => setSearchOpen(false)}
              />
            </PortalPopover>
          </div>
        ) : null}
      </div>

      {/* Header Actions */}
      <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-paper p-1 lg:ml-0 lg:gap-1">

        {/* Mobile Search Button */}
        {canSearch && (
          <button
            type="button"
            onClick={handleMobileSearchToggle}
            className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors lg:hidden ${
              mobileSearchOpen
                ? 'bg-accent-light text-accent'
                : 'text-ink-light hover:bg-surface hover:text-ink'
            }`}
            aria-label={mobileSearchOpen ? 'Close search' : 'Open search'}
            aria-expanded={mobileSearchOpen}
          >
            {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
          </button>
        )}

        {/* Notifications */}
        <div ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((current) => !current);
              setProfileOpen(false);
              setMobileSearchOpen(false);
              setSearchOpen(false);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-light transition-colors hover:bg-surface hover:text-ink"
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell size={18} />

            <AnimatePresence>
              {unreadCount > 0 && (
                <CountBadge
                  count={unreadCount}
                  label="unread notifications"
                  floating
                  className="ring-paper"
                />
              )}
            </AnimatePresence>
          </button>

          <PortalPopover
            anchorRef={notifRef}
            isOpen={notifOpen}
            onClose={() => setNotifOpen(false)}
            width={380}
          >
            <NotificationPanel
              onCountChange={refreshBadges}
              onClose={() => setNotifOpen(false)}
            />
          </PortalPopover>
        </div>

        {/* Profile */}
        <div ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((current) => !current);
              setNotifOpen(false);
              setMobileSearchOpen(false);
              setSearchOpen(false);
            }}
            className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:pr-2"
            aria-expanded={profileOpen}
            aria-label="Open profile menu"
          >
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-accent font-display text-[10px] font-bold text-white">
              {user?.avatarUrl && !avatarFailed ? (
                <img
                  src={user.avatarUrl}
                  alt={`${user?.name || 'User'} profile`}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : initials}
            </div>

            <span className="hidden max-w-[130px] truncate text-xs font-semibold text-ink sm:block">
              {user?.name || 'Account'}
            </span>

            <ChevronDown
              size={13}
              className={`hidden text-slate transition-transform duration-180 sm:block ${
                profileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <PortalPopover
            anchorRef={profileRef}
            isOpen={profileOpen}
            onClose={() => setProfileOpen(false)}
            width={280}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              transition={{ duration: 0.16 }}
              className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_18px_44px_rgba(22,35,59,0.16)]"
            >
              <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent font-display text-xs font-bold text-white">
                  {user?.avatarUrl && !avatarFailed ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : initials}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {user?.name || 'Account'}
                  </p>

                  <p className="truncate text-xs text-slate">
                    {ROLE_LABELS[userRole] || 'Account'}
                    {departmentLabel ? ` · ${departmentLabel}` : ''}
                  </p>
                </div>
              </div>

              <div className="p-1.5">
                <Link
                  to={`${profileBase}/profile`}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-ink/80 transition-colors hover:bg-paper-dim"
                >
                  <UserRound size={15} /> Profile
                </Link>

                <Link
                  to={`${profileBase}/profile#settings`}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-ink/80 transition-colors hover:bg-paper-dim"
                >
                  <Settings size={15} /> Settings
                </Link>

                <button
                  type="button"
                  onClick={() => setThemeOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-ink/80 transition-colors hover:bg-paper-dim"
                >
                  <span className="flex items-center gap-2.5">
                    <Sun size={15} /> Theme
                  </span>

                  <ChevronDown
                    size={13}
                    className={`text-slate transition-transform ${
                      themeOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {themeOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden px-1 pb-1"
                    >
                      <div className="grid grid-cols-3 gap-1 rounded-md bg-paper p-1">
                        {[
                          ['light', 'Light', Sun],
                          ['dark', 'Dark', Moon],
                          ['system', 'System', Monitor],
                        ].map(([value, label, Icon]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setTheme(value)}
                            className={`flex flex-col items-center gap-1 rounded px-1 py-2 text-[10px] font-semibold transition-colors ${
                              theme === value
                                ? 'bg-accent text-white'
                                : 'text-slate hover:bg-accent-light hover:text-ink'
                            }`}
                          >
                            <Icon size={14} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setPasswordOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-ink/80 transition-colors hover:bg-paper-dim"
                >
                  <KeyRound size={15} /> Change password
                </button>
              </div>

              <div className="border-t border-line p-1.5">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-clay transition-colors hover:bg-clay-light"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            </motion.div>
          </PortalPopover>
        </div>
      </div>

      {/* Mobile Search Field */}
      <AnimatePresence>
        {canSearch && mobileSearchOpen && (
          <motion.div
            ref={mobileSearchRef}
            initial={{ opacity: 0, height: 0, y: -5 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -5 }}
            transition={{ duration: 0.18 }}
            className="relative basis-full overflow-visible px-1 pb-1 lg:hidden"
          >
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate"
              />

              <input
                ref={mobileSearchInputRef}
                value={query}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') closeMobileSearch();
                }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search people, classes, subjects"
                className="field w-full border-line bg-paper py-3 pl-10 pr-4 text-sm shadow-none placeholder:text-slate/55 focus:bg-surface"
              />
            </div>

            <PortalPopover
              anchorRef={mobileSearchRef}
              isOpen={searchOpen && query.trim().length >= 2}
              onClose={closeMobileSearch}
              width={360}
              align="start"
              role="listbox"
            >
              <SearchResultsPanel
                results={searchResults}
                onClose={closeMobileSearch}
              />
            </PortalPopover>
          </motion.div>
        )}
      </AnimatePresence>

      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </header>
  );
}
