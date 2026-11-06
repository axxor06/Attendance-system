export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 12 characters, include uppercase and lowercase letters, a number, a special character, and have no leading or trailing spaces.';
export const PASSWORD_POLICY_HINT = 'At least 12 characters, including uppercase, lowercase, a number, and a symbol, with no leading or trailing spaces.';

export function getPasswordChecks(value = '') {
  return {
    length8: value.length >= 8,
    length12: value.length >= 12,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
    noLeadingWhitespace: value === value.trimStart(),
    noTrailingWhitespace: value === value.trimEnd(),
  };
}

export function isStrongPassword(value = '') {
  return Object.values(getPasswordChecks(value)).every(Boolean);
}

export const PASSWORD_CHECK_LABELS = {
  length8: 'At least 8 characters',
  length12: 'At least 12 characters',
  uppercase: 'At least 1 uppercase letter',
  lowercase: 'At least 1 lowercase letter',
  number: 'At least 1 number',
  symbol: 'At least 1 special character',
  noLeadingWhitespace: 'No leading whitespace',
  noTrailingWhitespace: 'No trailing whitespace',
};
