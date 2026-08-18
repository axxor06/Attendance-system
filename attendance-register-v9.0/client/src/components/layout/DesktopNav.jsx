import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getNavigationForRole } from './navigation.js';

export default function DesktopNav() {
  const { user } = useAuth();
  const sections = getNavigationForRole(user?.role);

  return (
    <nav className="hidden glass-subtle border-x-0 border-b border-white/65 px-4 py-2.5 shadow-[0_10px_28px_rgba(22,43,73,0.05)] md:block lg:px-7" aria-label="Primary navigation">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-5 gap-y-2">
        {sections.map((section) => (
          <div key={section.label} className="flex min-w-0 items-center gap-2">
            <span className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-slate/65 xl:inline">{section.label}</span>
            <div className="flex flex-wrap items-center gap-1">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === `/${user?.role}` || to === '/hod'}
                  className={({ isActive }) => clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-[background-color,color,box-shadow] duration-200',
                    isActive
                      ? 'bg-ink/92 text-paper shadow-[0_6px_16px_rgba(22,43,73,0.16)] backdrop-blur-md'
                      : 'text-slate hover:bg-ink/5 hover:text-ink',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
