import { motion } from 'framer-motion';
import clsx from 'clsx';

const variants = {
  primary: 'bg-indigo text-white shadow-[0_8px_20px_rgba(39,91,116,0.20)] hover:bg-indigo/92 hover:shadow-[0_12px_26px_rgba(39,91,116,0.25)]',
  amber: 'bg-amber text-ink shadow-[0_8px_20px_rgba(185,130,69,0.20)] hover:bg-amber/92 hover:shadow-[0_12px_26px_rgba(185,130,69,0.25)]',
  outline: 'border border-line bg-surface text-ink shadow-[0_3px_12px_rgba(16,47,66,0.05)] hover:border-indigo/35 hover:bg-indigo-light hover:shadow-[0_8px_20px_rgba(39,91,116,0.10)]',
  ghost: 'text-ink hover:bg-paper-dim',
  danger: 'bg-clay text-white shadow-[0_8px_20px_rgba(182,90,80,0.20)] hover:bg-clay/92 hover:shadow-[0_12px_26px_rgba(182,90,80,0.24)]',
  success: 'bg-sage text-white shadow-[0_8px_20px_rgba(15,128,105,0.20)] hover:bg-sage/92 hover:shadow-[0_12px_26px_rgba(15,128,105,0.24)]',
  indigo: 'bg-indigo text-white shadow-[0_8px_20px_rgba(39,91,116,0.20)] hover:bg-indigo/92 hover:shadow-[0_12px_26px_rgba(39,91,116,0.25)]',
};

const sizes = {
  sm: 'min-h-8 px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  isLoading = false,
  disabled,
  icon: Icon,
  type = 'button',
  ...props
}) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.975 }}
      transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
      aria-busy={isLoading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.01em] transition-[transform,background-color,border-color,box-shadow,color] duration-180 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-none',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <motion.span
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        Icon && <Icon aria-hidden="true" size={size === 'sm' ? 14 : 16} strokeWidth={2.1} />
      )}
      {children}
    </motion.button>
  );
}
