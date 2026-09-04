import { CalendarCheck2, QrCode, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '../../utils/motion.js';

const features = [
  { icon: CalendarCheck2, label: "Today's attendance", text: 'View periods and attendance status for the day.' },
  { icon: QrCode, label: 'QR attendance', text: 'Mark attendance quickly with a scoped session QR code.' },
  { icon: ShieldCheck, label: 'Protected records', text: 'Every workspace is limited by role and server authorization.' },
];

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[minmax(420px,0.84fr)_minmax(0,1.16fr)]">
      <main className="flex min-h-screen flex-col justify-center border-r border-line bg-surface px-5 py-8 sm:px-10 lg:px-16 lg:py-12" aria-labelledby="auth-title">
        <div className="mx-auto w-full max-w-[430px]">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-12 flex items-center gap-3 sm:mb-14"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent">
              <CalendarCheck2 size={19} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <div>
              <p className="font-display text-[17px] font-semibold leading-none text-ink">Attendance Register</p>
              <p className="mt-1 text-xs text-slate">Academic operations</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.04 }}>
            <h1 id="auth-title" className="max-w-sm font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
              {title}
            </h1>
            {subtitle && <p className="mt-4 max-w-md text-[15px] leading-7 text-slate">{subtitle}</p>}
          </motion.div>

          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="mt-9">
            {children}
          </motion.div>
        </div>
      </main>

      <aside className="relative hidden min-h-screen overflow-hidden bg-nav-deep px-10 py-12 text-white lg:flex lg:flex-col lg:justify-center xl:px-16" aria-label="Attendance Register highlights">
        <div className="relative max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="max-w-xl font-display text-[clamp(2.6rem,4.8vw,5rem)] font-medium leading-[0.98] tracking-[-0.03em] text-white"
          >
            Make every period count.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="mt-7 max-w-lg text-[15px] leading-7 text-white/60"
          >
            A calmer, clearer way to coordinate classes, attendance, and academic records across your campus.
          </motion.p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="relative mt-12 divide-y divide-white/10 border-y border-white/10"
        >
          {features.map(({ icon: Icon, label, text }) => (
            <motion.div key={label} variants={staggerItem} className="flex items-center gap-4 py-5">
              <Icon size={20} className="shrink-0 text-accent" strokeWidth={1.9} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-1 text-xs leading-5 text-white/50">{text}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </aside>
    </div>
  );
}
