const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getTime() <= todayUtc;
}

export function calculateAge(dateOfBirth, today = new Date()) {
  if (!isValidDateOnly(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)) age -= 1;
  return age >= 0 ? age : null;
}
