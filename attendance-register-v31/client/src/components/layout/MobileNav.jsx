import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { CalendarCheck2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getHomePath, getNavigationForRole, ROLE_LABELS } from './navigation.js';
import SidebarProfile from './SidebarProfile.jsx';

export default function MobileNav({ isOpen, onClose }) {
  const { user } = useAuth();
  const closeRef = useRef(null);
  const sections = getNavigationForRole(user?.role);
  const roleLabel = ROLE_LABELS[user?.role] || 'Account';

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[900] lg:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 h-full w-full cursor-default bg-nav-deep/75" onClick={onClose} aria-label="Close navigation" />
          <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }} className="absolute left-0 top-0 flex h-full w-[min(21rem,88vw)] flex-col bg-nav text-white shadow-[18px_0_50px_rgba(16,47,66,0.30)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber text-ink shadow-[0_6px_16px_rgba(185,130,69,0.16)]"><CalendarCheck2 size={20} aria-hidden="true" /></div>
                <div><p className="font-display text-base font-semibold text-white">Attendance Register</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{roleLabel}</p></div>
              </div>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close navigation" className="rounded-xl p-2 text-white/60 transition-[background-color,color,transform] duration-160 hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"><X size={19} /></button>
            </div>
            <nav className="flex-1 space-y-7 overflow-y-auto p-4" aria-label="Mobile primary navigation">
              {sections.map((section) => (
                <section key={section.label}>
                  <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{section.label}</p>
                  <div className="space-y-1">
                    {section.items.map(({ to, label, icon: Icon }) => (
                      <NavLink key={to} to={to} end={to === getHomePath(user?.role)} onClick={onClose} className={({ isActive }) => clsx('relative flex items-center gap-3 rounded-xl px-3.5 py-3.5 text-sm transition-[background-color,color,transform] duration-160', isActive ? 'bg-white/14 font-semibold text-white' : 'text-white/68 hover:translate-x-0.5 hover:bg-white/10 hover:text-white')}>
                        {({ isActive }) => <>{isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-amber" aria-hidden="true" />}<Icon size={17} strokeWidth={isActive ? 2.2 : 1.7} className={isActive ? 'text-amber' : 'text-white/50'} aria-hidden="true" />{label}</>}
                      </NavLink>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
            <SidebarProfile onNavigate={onClose} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
