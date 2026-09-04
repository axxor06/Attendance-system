import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Card({ children, className, glass = false, ...props }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-line/90 transition-[box-shadow,border-color,transform] duration-200',
        glass ? 'bg-paper-dim shadow-[0_5px_18px_rgba(16,47,66,0.045)]' : 'bg-cream shadow-[0_10px_28px_rgba(16,47,66,0.075)]',
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
      whileHover={{ y: -2, boxShadow: '0 16px 34px rgba(16,47,66,0.14)' }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      className={clsx('cursor-pointer rounded-2xl border border-line/90 bg-cream shadow-[0_10px_28px_rgba(16,47,66,0.075)]', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
