import crypto from 'crypto';
import { ATTENDANCE_CODE_ALPHABET, ATTENDANCE_CODE_LENGTH } from '../config/constants.js';

/**
 * Short attendance codes.
 *
 * Generated with crypto.randomInt (uniform, unbiased, CSPRNG-backed). The code
 * carries no information: it is a lookup key for a short-lived QrSession, never
 * a credential on its own. Validation additionally requires an authenticated,
 * active student in the session's class, and scan attempts are rate limited.
 *
 * Only a keyed digest (HMAC-SHA256) is stored, so a database leak does not
 * reveal live codes and the digest cannot be recomputed without the server key.
 */

const CODE_PATTERN = new RegExp(`^[${ATTENDANCE_CODE_ALPHABET}]{${ATTENDANCE_CODE_LENGTH}}$`);

export function generateAttendanceCode() {
  let code = '';
  for (let index = 0; index < ATTENDANCE_CODE_LENGTH; index += 1) {
    code += ATTENDANCE_CODE_ALPHABET[crypto.randomInt(0, ATTENDANCE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Students type or paste codes, so be forgiving about case, spaces and dashes
 * ("k7m2 p9q4"). Characters outside the alphabet are NOT silently remapped:
 * guessing what the student meant would widen the accepted input space.
 */
export function normalizeAttendanceCode(value) {
  return String(value ?? '').toUpperCase().replace(/[\s-]+/g, '');
}

export function isValidAttendanceCodeFormat(value) {
  return CODE_PATTERN.test(value);
}

function hmacKey() {
  // The access-token secret is already required (and strength-checked) at startup.
  return process.env.ATTENDANCE_CODE_SECRET || process.env.JWT_ACCESS_SECRET || 'attendance-code-development-key';
}

export function hashAttendanceCode(code) {
  return crypto.createHmac('sha256', hmacKey()).update(`attendance-code:${code}`).digest('hex');
}

export function qrSessionTtlMinutes() {
  const value = Number(process.env.QR_SESSION_TTL_MINUTES);
  return Number.isFinite(value) && value >= 1 && value <= 60 ? Math.floor(value) : 5;
}
