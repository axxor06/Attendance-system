export const ACADEMIC_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/ -]{1,79}$/;
export const ACADEMIC_IDENTIFIER_MESSAGE = 'Identifier must use 2–80 letters, numbers, spaces, dots, dashes, underscores, or slashes.';

export function normalizeAcademicIdentifier(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function isValidAcademicIdentifier(value) {
  return ACADEMIC_IDENTIFIER_PATTERN.test(normalizeAcademicIdentifier(value));
}
