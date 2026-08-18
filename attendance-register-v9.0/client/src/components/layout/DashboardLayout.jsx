import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Topbar from './Topbar.jsx';
import DesktopNav from './DesktopNav.jsx';
import MobileNav from './MobileNav.jsx';
import { pageTransition } from '../../utils/motion.js';

export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-ink">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <DesktopNav />
        <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-white/12 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="pointer-events-none absolute inset-0 opacity-35" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(22,43,73,0.05) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              className="relative mx-auto w-full max-w-7xl"
              initial={pageTransition.initial}
              animate={pageTransition.animate}
              exit={pageTransition.exit}
              transition={pageTransition.transition}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
