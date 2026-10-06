import clsx from 'clsx';

const variants = {
  present: 'bg-sage-light text-sage border-sage/30',
  late:    'bg-amber-light text-amber border-amber/30',
  absent:  'bg-clay-light text-clay border-clay/30',
  excused: 'bg-paper-dim text-ink-light border-ink/10',
  neutral: 'bg-paper-dim text-ink-light border-ink/10',
  amber:   'bg-amber-light text-amber border-amber/30',
  indigo:  'bg-indigo-light text-indigo border-indigo/25',
  sage:    'bg-sage-light text-sage border-sage/30',
};

export default function Badge({ children, variant = 'neutral', className }) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-[3px] border-l-2 px-2 py-0.5 text-[11px] font-semibold capitalize',
      variants[variant] || variants.neutral,
      className
    )}>
      {children}
    </span>
  );
}
