import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarCheck2, QrCode, ShieldCheck } from 'lucide-react';
import { staggerContainer, staggerItem } from '../../utils/motion.js';

const features = [
  { icon: CalendarCheck2, label: "Today's attendance", text: 'View periods and attendance status for the day.' },
  { icon: QrCode, label: 'QR attendance', text: 'Mark attendance quickly with a session QR code.' },
  { icon: ShieldCheck, label: 'Protected records', text: 'Access is limited by role and department.' },
];

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-transparent text-ink lg:grid lg:grid-cols-[minmax(400px,0.76fr)_minmax(0,1.24fr)]">
      <main className="flex min-h-screen flex-col justify-center bg-white/28 px-5 py-8 backdrop-blur-sm sm:px-10 lg:px-14 lg:py-12" aria-labelledby="auth-title">
        <div className="mx-auto w-full max-w-[430px]">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
            className="mb-14 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-ink text-amber shadow-[0_10px_24px_rgba(22,43,73,0.16)]">
                <CalendarCheck2 size={20} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-[17px] font-semibold leading-none text-ink">Attendance Register</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate/70">Academic operations</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-ink/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate sm:inline-flex">Secure access</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.44, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber">Welcome back</p>
            <h1 id="auth-title" className="max-w-sm font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">{title}</h1>
            {subtitle && <p className="mt-4 max-w-md text-[15px] leading-7 text-slate">{subtitle}</p>}
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="mt-9"
          >
            {children}
          </motion.div>
        </div>
      </main>

      <aside className="glass-dark relative hidden min-h-screen overflow-hidden bg-ink/88 px-10 py-12 text-paper lg:flex lg:flex-col lg:justify-between xl:px-16" aria-label="Attendance Register highlights">
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-paper/15" />
          <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full border border-paper/10" />
          <div className="absolute bottom-16 left-[-120px] h-72 w-72 rounded-full border border-amber/20" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(246,247,249,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(246,247,249,0.045)_1px,transparent_1px)] bg-[size:42px_42px]" />
        </div>

        <div className="relative flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-paper/55">
          <span>01 / 04</span>
          <span>Attendance Register</span>
        </div>

        <div className="relative max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-xl font-display text-[clamp(2.5rem,5vw,5.4rem)] font-medium leading-[0.98] tracking-[-0.05em] text-paper"
          >
            Attendance <span className="text-amber">overview.</span>
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.34 }}
            className="mt-7 max-w-lg text-[15px] leading-7 text-paper/60"
          >
            Track attendance, classes, and academic records in one place.
          </motion.p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="relative grid gap-3 xl:grid-cols-3"
        >
          {features.map(({ icon: Icon, label, text }) => (
            <motion.div
              key={label}
              variants={staggerItem}
              className="group rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-md transition-colors duration-200 hover:border-amber/35 hover:bg-white/[0.12]"
            >
              <div className="flex items-center justify-between">
                <Icon size={19} className="text-amber" strokeWidth={1.9} aria-hidden="true" />
                <ArrowUpRight size={15} className="text-paper/35 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber" aria-hidden="true" />
              </div>
              <p className="mt-8 text-sm font-semibold text-paper">{label}</p>
              <p className="mt-1.5 text-xs leading-5 text-paper/50">{text}</p>
            </motion.div>
          ))}
        </motion.div>
      </aside>
    </div>
  );
}
