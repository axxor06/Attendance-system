import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Card({ children, className, glass = false, ...props }) {
  return (
    <div
      className={clsx(
        'rounded-lg border elevate-sm transition-[box-shadow,border-color] duration-200',
        glass ? 'border-line/70 bg-paper-dim' : 'border-line bg-surface',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AnimatedCard({ children, className, onClick, ...props }) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      className={clsx('cursor-pointer rounded-lg border border-line bg-surface elevate-sm', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
