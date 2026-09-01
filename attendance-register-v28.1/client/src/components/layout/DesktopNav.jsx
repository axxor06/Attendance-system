/* eslint-disable react-refresh/only-export-components -- sidebar state hook is intentionally colocated with the rail */
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarCheck2, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getHomePath, getNavigationForRole } from './navigation.js';
import SidebarProfile from './SidebarProfile.jsx';

const STORAGE_KEY = 'attendance-register.sidebar-collapsed';

export default function DesktopNav({ collapsed, onToggle }) {
  const { user } = useAuth();
  const sections = getNavigationForRole(user?.role);

  return (
    <aside className={clsx('relative hidden h-full shrink-0 flex-col overflow-hidden bg-nav text-white transition-[width] duration-200 lg:flex lg:rounded-l-3xl', collapsed ? 'w-[78px]' : 'w-[276px]')} aria-label="Primary navigation">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-amber" aria-hidden="true" />
      <div className={clsx('flex h-[82px] shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center px-3' : 'justify-between px-5')}>
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber text-ink shadow-[0_6px_16px_rgba(185,130,69,0.16)]">
              <CalendarCheck2 size={18} strokeWidth={2.25} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-white">Attendance Register</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Academic operations</p>
            </div>
          </div>
        )}
        {collapsed && <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber text-ink shadow-[0_6px_16px_rgba(185,130,69,0.16)]"><CalendarCheck2 size={18} strokeWidth={2.25} aria-hidden="true" /></div>}
        <button type="button" onClick={onToggle} title={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} className="rounded-xl p-2 text-white/50 transition-[background-color,color,transform] duration-160 hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav className={clsx('flex-1 overflow-y-auto py-6', collapsed ? 'px-3' : 'px-4')} aria-label="Primary navigation">
        {sections.map((section) => (
          <section key={section.label} className="mb-7 last:mb-0">
            {!collapsed && <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-white/32">{section.label}</p>}
            <div className="space-y-1">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === getHomePath(user?.role)} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={({ isActive }) => clsx('group relative flex items-center rounded-xl transition-[background-color,color,transform] duration-160 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber', collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-2.5 text-sm', isActive ? 'bg-white/14 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-amber' : 'text-white/68 hover:bg-white/10 hover:text-white')}>
                  {({ isActive }) => (
                    <>
                      <Icon size={collapsed ? 18 : 17} strokeWidth={isActive ? 2.2 : 1.7} className={clsx('shrink-0', isActive ? 'text-amber' : 'text-white/45 group-hover:text-white/80')} aria-hidden="true" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>
      <SidebarProfile collapsed={collapsed} showActions={false} />
    </aside>
  );
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch { /* storage is optional */ }
  }, [collapsed]);
  return [collapsed, () => setCollapsed((value) => !value)];
}
