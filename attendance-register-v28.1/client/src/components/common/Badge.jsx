import clsx from 'clsx';

const variants = {
  present: 'bg-sage/15 text-sage border border-sage/20',
  late:    'bg-amber/15 text-amber border border-amber/20',
  absent:  'bg-clay/15 text-clay border border-clay/20',
  excused: 'bg-indigo/8 text-ink/60 border border-ink/10',
  neutral: 'bg-indigo/8 text-ink/60 border border-ink/10',
  amber:   'bg-amber/15 text-amber border border-amber/20',
  indigo:  'bg-indigo/12 text-indigo border border-indigo/20',
  sage:    'bg-sage/15 text-sage border border-sage/20',
};

export default function Badge({ children, variant = 'neutral', className }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize tracking-wide',
      variants[variant] || variants.neutral,
      className
    )}>
      {children}
    </span>
  );
}
