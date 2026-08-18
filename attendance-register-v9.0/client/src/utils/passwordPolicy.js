export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.';

export const PASSWORD_POLICY_HINT = 'At least 12 characters, including uppercase, lowercase, a number, and a symbol.';

export function getPasswordChecks(value = '') {
  return {
    length: value.length >= 12,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}

export function isStrongPassword(value = '') {
  const checks = getPasswordChecks(value);
  return Object.values(checks).every(Boolean);
}
