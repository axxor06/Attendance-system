import { useId, useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import Input from './Input.jsx';
import { getPasswordChecks, PASSWORD_CHECK_LABELS, isStrongPassword } from '../../utils/passwordPolicy.js';

export default function PasswordField({
  label = 'Password',
  name = 'password',
  value = '',
  onChange,
  required = true,
  confirmValue,
  onConfirmChange,
  confirmLabel = 'Confirm password',
  confirmName = 'confirmPassword',
  hint,
  disabled = false,
}) {
  const [visible, setVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const checklistId = useId();
  const checks = getPasswordChecks(value);
  const hasConfirmation = typeof onConfirmChange === 'function';
  const matches = !hasConfirmation || (value.length > 0 && value === confirmValue);
  const showChecklist = value.length > 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          label={label}
          type={visible ? 'text' : 'password'}
          name={name}
          required={required}
          minLength={12}
          value={value}
          onChange={onChange}
          hint={hint}
          disabled={disabled}
          aria-describedby={showChecklist ? checklistId : undefined}
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setVisible((state) => !state)}
          className="absolute right-3 top-[34px] rounded-lg p-1.5 text-slate transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>

      {showChecklist && (
        <div id={checklistId} className="rounded-xl border border-ink/10 bg-paper/70 px-3.5 py-3" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink">Password requirements</p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {Object.entries(PASSWORD_CHECK_LABELS).map(([key, text]) => {
              const valid = checks[key];
              return (
                <p key={key} className={`flex items-center gap-1.5 text-xs ${valid ? 'text-sage' : 'text-clay'}`}>
                  {valid ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                  <span>{text}</span>
                </p>
              );
            })}
          </div>
          {isStrongPassword(value) && <p className="mt-2 text-xs font-semibold text-sage">Password meets all requirements.</p>}
        </div>
      )}

      {hasConfirmation && (
        <div className="relative">
          <Input
            label={confirmLabel}
            type={confirmVisible ? 'text' : 'password'}
            name={confirmName}
            required={required}
            value={confirmValue || ''}
            onChange={onConfirmChange}
            disabled={disabled}
            error={confirmValue?.length > 0 && !matches ? 'Passwords do not match.' : undefined}
            hint={confirmValue?.length > 0 && matches ? 'Passwords match.' : undefined}
          />
          <button
            type="button"
            aria-label={confirmVisible ? `Hide ${confirmLabel.toLowerCase()}` : `Show ${confirmLabel.toLowerCase()}`}
            onClick={() => setConfirmVisible((state) => !state)}
            className="absolute right-3 top-[34px] rounded-lg p-1.5 text-slate transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            {confirmVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}
