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
    <aside className={clsx('relative hidden h-full shrink-0 flex-col bg-nav text-white transition-[width] duration-220 ease-out lg:flex', collapsed ? 'w-[76px]' : 'w-[272px]')} aria-label="Primary navigation">
      <div className={clsx('flex h-[76px] shrink-0 items-center bg-nav-deep', collapsed ? 'justify-center px-0' : 'justify-between px-5')}>
        {!collapsed ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber text-nav shadow-md">
              <CalendarCheck2 size={19} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <p className="truncate font-display text-[17px] font-semibold text-white">Attendance Register</p>
          </div>
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-amber text-nav shadow-md">
            <CalendarCheck2 size={19} strokeWidth={2.4} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mx-4 h-px bg-white/10" />

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Primary navigation">
        {sections.map((section, sectionIndex) => (
          <section key={section.label} className={clsx(sectionIndex > 0 && 'mt-6')}>
            {!collapsed && (
              <div className="mb-2 flex items-center gap-2 px-2">
                <span className="h-1 w-1 rounded-full bg-amber/70" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{section.label}</p>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === getHomePath(user?.role)}
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={({ isActive }) => clsx(
                    'group flex items-center rounded-lg transition-colors duration-160 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber',
                    collapsed ? 'justify-center py-2.5' : 'gap-3 px-2.5 py-2.5',
                    isActive ? 'bg-white text-nav' : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-160', isActive ? 'bg-amber-light text-nav' : 'bg-white/[0.06] text-white/55 group-hover:bg-white/10 group-hover:text-white')}>
                        <Icon size={16} strokeWidth={2} aria-hidden="true" />
                      </span>
                      {!collapsed && <span className={clsx('truncate text-[13.5px]', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="mx-4 h-px bg-white/10" />
      <SidebarProfile collapsed={collapsed} showActions={false} />

      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        className="absolute -right-3 top-[34px] flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-nav text-white/70 shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-colors hover:bg-nav-deep hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
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
