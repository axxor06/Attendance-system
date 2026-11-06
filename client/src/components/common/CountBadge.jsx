import clsx from 'clsx';

/**
 * One red badge with a white number: the total, never one dot per item.
 * Shows the real number (1, 12, 100, 1250 ...) and is never capped.
 */
export default function CountBadge({ count, label, className, floating = false }) {
  const value = Number(count) || 0;
  if (value <= 0) return null;
  return (
    <span
      role="status"
      aria-label={label ? `${value} ${label}` : `${value}`}
      className={clsx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay px-1.5 text-[11px] font-bold leading-none tabular-nums text-white',
        floating && 'absolute -right-1 -top-1 ring-2 ring-nav',
        className,
      )}
    >
      {value}
    </span>
  );
}
