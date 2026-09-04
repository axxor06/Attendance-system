import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Topbar from './Topbar.jsx';
import DesktopNav, { useSidebarState } from './DesktopNav.jsx';
import MobileNav from './MobileNav.jsx';
import { pageTransition } from '../../utils/motion.js';

export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, toggleSidebar] = useSidebarState();
  const location = useLocation();

  return (
    <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-canvas p-0 text-ink lg:p-2.5">
      <DesktopNav collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper lg:rounded-r-3xl lg:border-y lg:border-r lg:border-line/80 lg:shadow-[0_12px_34px_rgba(16,47,66,0.09)]">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} sidebarCollapsed={sidebarCollapsed} />
        <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-paper px-4 py-5 sm:px-6 sm:py-8 lg:px-9 lg:py-9 2xl:px-11 2xl:py-11">
          <div className="pointer-events-none absolute inset-0 opacity-[0.035]" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(16,47,66,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(16,47,66,0.045) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <motion.div
            key={location.pathname}
            className="relative mx-auto min-w-0 w-full max-w-7xl 2xl:max-w-[96rem]"
            initial={pageTransition.initial}
            animate={pageTransition.animate}
            transition={pageTransition.transition}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
