// Attendance codes: 8 characters from an alphabet without 0/O/1/I/L (see the server's
// ATTENDANCE_CODE_ALPHABET). The server is the only authority on validity; this helper
// just keeps what students type or scan tidy.
export const ATTENDANCE_CODE_LENGTH = 8;
const ALLOWED = /[A-HJKMNP-Z2-9]/g;

/** Uppercases, drops spaces/dashes/other characters, and caps the length. */
export function normalizeCodeInput(value) {
  return (String(value ?? '').toUpperCase().match(ALLOWED) || []).join('').slice(0, ATTENDANCE_CODE_LENGTH);
}

export function isCompleteCode(value) {
  return normalizeCodeInput(value).length === ATTENDANCE_CODE_LENGTH && normalizeCodeInput(value) === String(value).toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Pulls a code out of whatever a QR contains: a bare code, or a link such as
 * https://host/scan-qr?code=K7M2P9Q4 (the older ?token= parameter is honoured too).
 * Returns '' when nothing usable is found.
 */
export function extractCodeFromScan(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://placeholder.invalid');
    const fromQuery = url.searchParams.get('code') || url.searchParams.get('token');
    if (fromQuery) return normalizeCodeInput(fromQuery);
  } catch { /* not a URL */ }
  return normalizeCodeInput(raw);
}

export function formatCodeForDisplay(code) {
  const text = String(code ?? '');
  return text.length === ATTENDANCE_CODE_LENGTH ? `${text.slice(0, 4)} ${text.slice(4)}` : text;
}

/** Maps a failed scan response to a state the page can present clearly. */
export function classifyScanError(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.error?.code || error?.response?.data?.code;
  if (!error?.response) return 'network';
  if (code === 'ATTENDANCE_ALREADY_MARKED' || status === 409) return 'already';
  if (status === 410) return 'expired';
  if (status === 429) return 'rate-limited';
  if (status === 403) return 'not-allowed';
  if (status === 400 || status === 422) return 'invalid';
  return 'error';
}
