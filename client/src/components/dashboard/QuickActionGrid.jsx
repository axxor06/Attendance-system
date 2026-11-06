import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function QuickActionGrid({ actions = [] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map(({ to, label, description, icon: Icon, tone = 'ink' }) => (
        <Link key={to} to={to} className="group min-w-0">
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.985 }}
            className="flex h-full min-h-[116px] flex-col justify-between rounded-xl border border-line bg-cream p-4 shadow-[0_5px_18px_rgba(79,70,165,0.04)] transition-[border-color,box-shadow,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-amber/45 hover:bg-paper-dim hover:shadow-[0_12px_26px_rgba(79,70,165,0.09)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`rounded-lg p-2 ${tone === 'amber' ? 'bg-amber/15 text-amber' : tone === 'sage' ? 'bg-sage/15 text-sage' : tone === 'indigo' ? 'bg-indigo/15 text-indigo' : 'bg-indigo/8 text-ink'}`}>
                <Icon size={17} aria-hidden="true" />
              </div>
              <ArrowUpRight size={16} className="text-slate/50 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber" aria-hidden="true" />
            </div>
            <div className="mt-5 min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{label}</p>
              <p className="mt-1 truncate text-xs text-slate">{description}</p>
            </div>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}
