import clsx from 'clsx';
import { ATTENDANCE_STATUSES } from '../../utils/attendanceStatus.js';

/** Accessible segmented control for one student's attendance status. */
export default function StatusToggle({ name, value, onChange, disabled = false }) {
  return (
    <div role="radiogroup" aria-label={`Attendance for ${name}`} className="inline-flex overflow-hidden rounded-md border border-line">
      {ATTENDANCE_STATUSES.map((status) => {
        const selected = value === status.value;
        return (
          <button
            key={status.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={status.label}
            title={status.label}
            disabled={disabled}
            onClick={() => onChange(status.value)}
            className={clsx(
              'min-h-10 min-w-10 border-r border-line px-2.5 text-sm font-semibold transition-colors last:border-r-0 focus-visible:z-10',
              selected ? status.active : 'bg-surface text-slate hover:bg-paper-dim hover:text-ink',
            )}
          >
            {status.short}
          </button>
        );
      })}
    </div>
  );
}
