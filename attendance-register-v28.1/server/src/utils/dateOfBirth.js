const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 1900;

export function isValidDateOnly(value, { allowFuture = false } = {}) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < MIN_YEAR || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  if (!allowFuture && date.getTime() > Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) return false;
  return true;
}

export function calculateAge(dateOfBirth, today = new Date()) {
  if (!isValidDateOnly(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();
  let age = currentYear - year;
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age >= 0 ? age : null;
}

export function normalizeDateOnly(value) {
  if (!isValidDateOnly(value)) return null;
  return value;
}
