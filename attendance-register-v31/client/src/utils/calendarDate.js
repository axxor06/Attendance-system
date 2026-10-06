import { format } from 'date-fns';

const DATE_ONLY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseCalendarDate(value) {
  const match = String(value || '').match(DATE_ONLY_PREFIX);
  if (match) {
    const [, year, month, day] = match.map(Number);
    const localDate = new Date(year, month - 1, day);
    if (localDate.getFullYear() === year && localDate.getMonth() === month - 1 && localDate.getDate() === day) return localDate;
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatCalendarDate(value, pattern = 'MMM d, yyyy', fallback = '—') {
  const parsed = parseCalendarDate(value);
  return parsed ? format(parsed, pattern) : fallback;
}
