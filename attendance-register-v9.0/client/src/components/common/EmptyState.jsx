import { motion } from 'framer-motion';

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink/12 bg-paper-dim/40 px-6 py-14 text-center"
    >
      {Icon && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 20 }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/5 text-ink/30"
        >
          <Icon size={24} />
        </motion.div>
      )}
      <div>
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        {message && <p className="mt-1 text-sm text-slate">{message}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
