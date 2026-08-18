import { motion } from 'framer-motion';
import clsx from 'clsx';

const variants = {
  primary: 'bg-ink text-paper shadow-[0_8px_20px_rgba(22,43,73,0.14)] hover:-translate-y-0.5 hover:bg-ink-light hover:shadow-[0_12px_26px_rgba(22,43,73,0.18)]',
  amber: 'bg-amber text-ink shadow-[0_8px_20px_rgba(178,122,53,0.18)] hover:-translate-y-0.5 hover:bg-amber-light',
  outline: 'border border-white/70 bg-white/42 text-ink shadow-[0_8px_20px_rgba(22,43,73,0.05)] backdrop-blur-md hover:-translate-y-0.5 hover:border-white hover:bg-white/72',
  ghost: 'text-ink hover:bg-white/45',
  danger: 'bg-clay text-white shadow-[0_8px_20px_rgba(181,86,78,0.16)] hover:-translate-y-0.5 hover:bg-clay/90',
  success: 'bg-sage text-white shadow-[0_8px_20px_rgba(63,118,109,0.16)] hover:-translate-y-0.5 hover:bg-sage/90',
  indigo: 'bg-indigo text-white shadow-[0_8px_20px_rgba(94,110,149,0.16)] hover:-translate-y-0.5 hover:bg-indigo/90',
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
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.01em] transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
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
