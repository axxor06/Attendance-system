import clsx from 'clsx';
import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(function Select({ label, error, hint, className, id, children, ...props }, ref) {
  const generatedId = useId();
  const selectId = id || props.name || generatedId;
  const descriptionId = `${selectId}-description`;
  const hasDescription = Boolean(error || hint);
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-light">
          <span>{label}</span>
          {props.required && <span className="text-xs font-medium text-slate/70">Required</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hasDescription ? descriptionId : undefined}
          className={clsx(
            'min-h-12 w-full cursor-pointer appearance-none rounded-md border bg-cream px-3.5 pr-10 text-[15px] text-ink',
            'transition-[border-color,box-shadow] duration-180',
            'focus:outline-none focus:ring-3 focus:ring-accent-light',
            'disabled:cursor-not-allowed disabled:bg-paper-dim disabled:opacity-60',
            error ? 'border-clay ring-3 ring-clay-light' : 'border-line hover:border-accent/40 focus:border-accent',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate" />
      </div>
      {hasDescription && (
        <span id={descriptionId} className={clsx('text-xs leading-5', error ? 'font-medium text-clay' : 'text-slate')}>{error || hint}</span>
      )}
    </div>
  );
});

export default Select;
