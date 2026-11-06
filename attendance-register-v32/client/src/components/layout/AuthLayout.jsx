import { CalendarCheck2 } from 'lucide-react';
import { motion } from 'framer-motion';

// A stylized attendance register grid - not a literal screenshot, a rhythm
// of filled cells evoking a real marked-up register. Deterministic per
// render (no Math.random) so it doesn't shift on re-render or hydration.
const GRID_PATTERN = [
  'sage', 'sage', 'sage', 'amber', 'sage', 'sage', 'sage',
  'sage', 'clay', 'sage', 'sage', 'sage', 'sage', 'amber',
  'sage', 'sage', 'sage', 'sage', 'clay', 'sage', 'sage',
  'amber', 'sage', 'sage', 'sage', 'sage', 'sage', 'sage',
  'sage', 'sage', 'clay', 'sage', 'sage', 'sage', 'sage',
];
const CELL_COLOR = { sage: 'bg-sage/70', clay: 'bg-clay/70', amber: 'bg-amber/70' };

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

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.08 }} className="mt-9">
            {children}
          </motion.div>
        </div>
      </main>

      <aside className="relative hidden min-h-screen items-center overflow-hidden bg-nav-deep px-10 py-12 text-white lg:flex xl:px-16" aria-hidden="true">
        <div className="mx-auto grid w-full max-w-md grid-cols-7 gap-2.5">
          {GRID_PATTERN.map((status, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.15 + index * 0.014, ease: [0.23, 1, 0.32, 1] }}
              className={`aspect-square rounded-[3px] ${CELL_COLOR[status]}`}
            />
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="absolute bottom-14 left-10 right-10 border-t border-white/10 pt-6 xl:left-16 xl:right-16"
        >
          <p className="font-display text-2xl font-medium leading-tight tracking-[-0.02em] text-white">Every period, on the record.</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">Attendance, timetables, and academic records for your whole campus, authorized by role at the server.</p>
        </motion.div>
      </aside>
    </div>
  );
}
