import { useEffect, useState } from 'react';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ChangePasswordModal from '../common/ChangePasswordModal.jsx';
import { getProfileBase, ROLE_LABELS } from './navigation.js';

export default function SidebarProfile({ collapsed = false, onNavigate, showActions = true }) {
  const { user, logout } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const profileBase = getProfileBase(user?.role);
  const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U';

  useEffect(() => setAvatarFailed(false), [user?.avatarUrl]);

  async function handleLogout() {
    onNavigate?.();
    try {
      await logout();
      toast.success('You have been signed out.');
    } catch {
      toast.error('Signed out locally. Please close any other active tabs.');
    }
  }

  const avatar = user?.avatarUrl && !avatarFailed ? (
    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} />
  ) : initials;

  if (!showActions) {
    return (
      <div className="border-t border-white/10 px-3 py-4" title="Profile and account controls are available in the top-right menu">
        <div className={collapsed ? 'flex justify-center' : 'flex items-center gap-3 px-2'}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-amber font-display text-[11px] font-bold text-ink shadow-[0_6px_16px_rgba(0,0,0,0.18)]" aria-hidden="true">{avatar}</div>
          {!collapsed && <div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{user?.name || 'Account'}</p><p className="mt-0.5 truncate text-[10px] text-white/45">Account controls in header</p></div>}
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-white/10 px-3 py-4">
        <Link to={`${profileBase}/profile`} onClick={onNavigate} title="My profile" aria-label="My profile" className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-amber font-display text-xs font-bold text-ink shadow-[0_6px_16px_rgba(0,0,0,0.18)] transition-transform hover:scale-[1.03]">
          {avatar}
        </Link>
        <button type="button" onClick={() => setPasswordOpen(true)} title="Change password" aria-label="Change password" className="rounded-xl p-2 text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
          <KeyRound size={16} />
        </button>
        <button type="button" onClick={handleLogout} title="Sign out" aria-label="Sign out" className="rounded-xl p-2 text-white/55 transition-colors hover:bg-clay/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
          <LogOut size={16} />
        </button>
        <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 px-4 py-4">
      <Link to={`${profileBase}/profile`} onClick={onNavigate} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-[background-color,transform] duration-160 hover:bg-white/8 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-amber font-display text-xs font-bold text-ink shadow-[0_6px_16px_rgba(0,0,0,0.18)]">{avatar}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user?.name || 'Account'}</p>
          <p className="mt-0.5 truncate text-[11px] text-white/50">{ROLE_LABELS[user?.role] || 'Account'}</p>
        </div>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to={`${profileBase}/profile`} onClick={onNavigate} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] font-semibold text-white/65 transition-[background-color,color,border-color] hover:border-white/20 hover:bg-white/8 hover:text-white"><UserRound size={14} /> Profile</Link>
        <button type="button" onClick={() => setPasswordOpen(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] font-semibold text-white/65 transition-[background-color,color,border-color] hover:border-white/20 hover:bg-white/8 hover:text-white"><KeyRound size={14} /> Password</button>
      </div>
      <button type="button" onClick={handleLogout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/80 transition-[background-color,color] hover:bg-clay/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"><LogOut size={15} /> Sign out</button>
      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
