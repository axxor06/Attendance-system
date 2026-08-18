import { useRef } from 'react';

export default function OtpInput({ value, onChange, length = 6 }) {
  const inputsRef = useRef([]);

  function handleChange(index, digit) {
    const clean = digit.replace(/\D/g, '').slice(-1);
    const chars = value.split('');
    chars[index] = clean;
    const next = chars.join('').slice(0, length);
    onChange(next);

    if (clean && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-11 rounded-xl border border-ink/15 bg-white text-center font-mono text-lg font-semibold text-ink focus:border-ink/40 focus:outline-none"
        />
      ))}
    </div>
  );
}
