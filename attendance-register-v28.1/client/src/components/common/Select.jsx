import clsx from 'clsx';
import { forwardRef } from 'react';

const Select = forwardRef(function Select({ label, error, className, id, children, ...props }, ref) {
  const selectId = id || props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-ink/80">
          {label}
        </label>
      )}
      <select
        id={selectId}
        ref={ref}
        className={clsx(
          'w-full rounded-[10px] border border-line bg-cream px-3.5 py-2.5 text-sm text-ink shadow-[0_3px_10px_rgba(79,70,165,0.035)]',
          'transition-colors appearance-none cursor-pointer',
          'focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/12',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-clay' : 'border-line',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs font-medium text-clay">{error}</span>}
    </div>
  );
});

export default Select;
