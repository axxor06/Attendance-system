import { motion } from 'framer-motion';
import clsx from 'clsx';

const variants = {
  primary: 'bg-accent text-white border border-accent hover:bg-accent/90',
  amber: 'bg-amber text-white border border-amber hover:bg-amber/90',
  outline: 'border border-line bg-surface text-ink hover:border-accent/50 hover:bg-accent-light/40',
  ghost: 'text-ink hover:bg-paper-dim',
  danger: 'bg-clay text-white border border-clay hover:bg-clay/90',
  success: 'bg-sage text-white border border-sage hover:bg-sage/90',
  indigo: 'bg-indigo text-white border border-indigo hover:bg-indigo/90',
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
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-[-0.01em] transition-[background-color,border-color,color] duration-180 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
        'disabled:cursor-not-allowed disabled:opacity-55',
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
