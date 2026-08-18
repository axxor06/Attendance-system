import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Card({ children, className, glass = false, ...props }) {
  return (
    <div
      className={clsx(
        'rounded-[24px] border border-ink/[0.08] transition-[box-shadow,border-color,transform] duration-200',
        glass ? 'glass-subtle' : 'glass-surface',
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
      whileHover={{ y: -2, boxShadow: '0 22px 48px rgba(22,43,73,0.13)' }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      className={clsx('glass-surface cursor-pointer rounded-[24px]', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
