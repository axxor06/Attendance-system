import { forwardRef } from 'react';
import clsx from 'clsx';

const Input = forwardRef(function Input({ label, error, hint, className, id, icon: Icon, endAdornment, ...props }, ref) {
  const inputId = id || props.name;
  const descriptionId = `${inputId || 'field'}-description`;
  const hasDescription = Boolean(error || hint);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-ink/65">
          <span>{label}</span>
          {props.required && <span className="text-[10px] font-semibold normal-case tracking-normal text-slate/60">Required</span>}
        </label>
      )}
      <div className="relative">
        {Icon && <Icon aria-hidden="true" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate/60" />}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hasDescription ? descriptionId : undefined}
          className={clsx(
            'min-h-12 w-full rounded-[14px] border bg-white/52 px-3.5 text-[15px] text-ink shadow-[0_8px_18px_rgba(22,43,73,0.04)] backdrop-blur-md',
            'placeholder:text-slate/45 transition-[border-color,box-shadow,background-color] duration-200',
            'focus:border-amber focus:bg-white/78 focus:outline-none focus:ring-4 focus:ring-amber/12',
            'disabled:cursor-not-allowed disabled:bg-paper-dim disabled:opacity-60',
            Icon && 'pl-10',
            endAdornment && 'pr-11',
            error ? 'border-clay ring-4 ring-clay/10' : 'border-ink/12 hover:border-ink/25',
            className,
          )}
          {...props}
        />
        {endAdornment && <div className="absolute right-3 top-1/2 -translate-y-1/2">{endAdornment}</div>}
      </div>
      {hasDescription && (
        <span id={descriptionId} className={clsx('text-xs leading-5', error ? 'font-medium text-clay' : 'text-slate')}>
          {error || hint}
        </span>
      )}
    </div>
  );
});

export default Input;
