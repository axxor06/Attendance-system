import { motion } from 'framer-motion';
import clsx from 'clsx';
import { staggerItem } from '../../utils/motion.js';

const ACCENT_STYLES = {
  ink: { icon: 'bg-ink/10 text-ink', line: 'bg-ink' },
  amber: { icon: 'bg-amber/15 text-amber', line: 'bg-amber' },
  sage: { icon: 'bg-sage/15 text-sage', line: 'bg-sage' },
  clay: { icon: 'bg-clay/15 text-clay', line: 'bg-clay' },
  indigo: { icon: 'bg-indigo/15 text-indigo', line: 'bg-indigo' },
  violet: { icon: 'bg-violet/15 text-violet', line: 'bg-violet' },
};

export default function StatCard({ label, value, sublabel, icon: Icon, accent = 'ink', trend, percentage }) {
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.ink;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3, boxShadow: '0 16px 36px rgba(22,43,73,0.10)' }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-[24px] border border-ink/[0.08] bg-white p-5 shadow-[0_8px_28px_rgba(22,43,73,0.055)]"
    >
      <div className={clsx('absolute inset-x-5 top-0 h-1 rounded-b-full', styles.line)} aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate/70">{label}</p>
          <p className="mt-3 font-display text-[2.2rem] font-semibold leading-none tracking-[-0.04em] text-ink">{value}</p>
          {sublabel && <p className="mt-2 text-xs text-slate">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', styles.icon)}>
            <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
          </div>
        )}
      </div>

      {percentage !== undefined && (
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs text-slate"><span>Progress</span><span>{percentage}%</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
            <motion.div
              className={clsx('h-full rounded-full', styles.line)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, percentage)}%` }}
              transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.15 }}
            />
          </div>
        </div>
      )}

      {trend && (
        <p className={clsx('mt-4 flex items-center gap-1 text-xs font-semibold', trend.direction === 'up' ? 'text-sage' : 'text-clay')}>
          <span aria-hidden="true">{trend.direction === 'up' ? '↑' : '↓'}</span>{trend.label}
        </p>
      )}
    </motion.div>
  );
}
