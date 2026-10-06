export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.';

export function isStrongPassword(value) {
  return typeof value === 'string'
    && value === value.trim()
    && value.length >= 12
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}
