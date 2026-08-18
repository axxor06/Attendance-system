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
            className="glass-subtle flex h-full min-h-[116px] flex-col justify-between rounded-[22px] p-4 transition-[border-color,box-shadow,background-color] duration-200 hover:border-white hover:bg-white/62 hover:shadow-[0_18px_38px_rgba(22,43,73,0.1)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`rounded-xl p-2 ${tone === 'amber' ? 'bg-amber/15 text-amber' : tone === 'sage' ? 'bg-sage/15 text-sage' : tone === 'indigo' ? 'bg-indigo/15 text-indigo' : 'bg-ink/8 text-ink'}`}>
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
