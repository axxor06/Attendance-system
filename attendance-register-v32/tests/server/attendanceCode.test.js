import test from 'node:test';
import assert from 'node:assert/strict';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
const { generateAttendanceCode, hashAttendanceCode, isValidAttendanceCodeFormat, normalizeAttendanceCode, qrSessionTtlMinutes } = await import('../../server/src/utils/attendanceCode.js');
const { ATTENDANCE_CODE_ALPHABET } = await import('../../server/src/config/constants.js');
const { getEditability, correctionWindowDays, assertNotFutureDate } = await import('../../server/src/services/attendanceCorrectionService.js');

test('codes are 8 characters from an unambiguous alphabet', () => {
  assert.equal(new Set(ATTENDANCE_CODE_ALPHABET).size, ATTENDANCE_CODE_ALPHABET.length);
  assert.ok(!/[01OIL]/.test(ATTENDANCE_CODE_ALPHABET));
  for (let i = 0; i < 500; i += 1) assert.ok(isValidAttendanceCodeFormat(generateAttendanceCode()));
});

test('generator is statistically uniform across the alphabet and has no collisions in 20k draws', () => {
  const counts = new Map();
  const seen = new Set();
  const draws = 20000;
  for (let i = 0; i < draws; i += 1) {
    const code = generateAttendanceCode();
    seen.add(code);
    for (const ch of code) counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  assert.equal(seen.size, draws);
  const expected = (draws * 8) / ATTENDANCE_CODE_ALPHABET.length;
  for (const ch of ATTENDANCE_CODE_ALPHABET) {
    const observed = counts.get(ch) || 0;
    assert.ok(Math.abs(observed - expected) / expected < 0.08, `${ch}: ${observed} vs ${expected.toFixed(0)}`);
  }
});

test('normalisation forgives case, spaces and dashes but never remaps characters', () => {
  assert.equal(normalizeAttendanceCode(' k7m2-p9q4 '), 'K7M2P9Q4');
  assert.ok(isValidAttendanceCodeFormat(normalizeAttendanceCode('k7m2 p9q4')));
  assert.ok(!isValidAttendanceCodeFormat('K7M2P9Q0'), '0 is not in the alphabet and is not silently converted to O');
  assert.ok(!isValidAttendanceCodeFormat('K7M2P9Q'));
  assert.ok(!isValidAttendanceCodeFormat('K7M2P9Q4X'));
  assert.ok(!isValidAttendanceCodeFormat("K7M2P9Q'"));
});

test('stored digest is keyed, deterministic and does not contain the code', () => {
  const digest = hashAttendanceCode('K7M2P9Q4');
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, hashAttendanceCode('K7M2P9Q4'));
  assert.notEqual(digest, hashAttendanceCode('K7M2P9Q5'));
  const original = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = 'a-different-secret-a-different-secret';
  assert.notEqual(digest, hashAttendanceCode('K7M2P9Q4'), 'digest depends on the server key');
  process.env.JWT_ACCESS_SECRET = original;
});

test('session TTL is configurable and bounded', () => {
  delete process.env.QR_SESSION_TTL_MINUTES;
  assert.equal(qrSessionTtlMinutes(), 5);
  process.env.QR_SESSION_TTL_MINUTES = '10';
  assert.equal(qrSessionTtlMinutes(), 10);
  for (const bad of ['0', '-3', '999', 'abc']) { process.env.QR_SESSION_TTL_MINUTES = bad; assert.equal(qrSessionTtlMinutes(), 5); }
  delete process.env.QR_SESSION_TTL_MINUTES;
});

test('correction window policy: default 30 days, HOD exempt, 0 disables, future dates rejected', () => {
  delete process.env.ATTENDANCE_CORRECTION_WINDOW_DAYS;
  assert.equal(correctionWindowDays(), 30);
  const now = new Date('2026-10-31T12:00:00Z');
  const faculty = { role: 'admin' };
  const hod = { role: 'super_admin' };
  assert.equal(getEditability(faculty, '2026-10-30', now).editable, true, 'next-day correction works');
  assert.equal(getEditability(faculty, '2026-10-01', now).editable, true);
  assert.equal(getEditability(faculty, '2026-09-30', now).editable, false);
  assert.equal(getEditability(hod, '2020-01-01', now).editable, true);
  process.env.ATTENDANCE_CORRECTION_WINDOW_DAYS = '0';
  assert.equal(getEditability(faculty, '2020-01-01', now).editable, true);
  process.env.ATTENDANCE_CORRECTION_WINDOW_DAYS = '7';
  assert.equal(getEditability(faculty, '2026-10-20', now).editable, false);
  process.env.ATTENDANCE_CORRECTION_WINDOW_DAYS = 'nonsense';
  assert.equal(correctionWindowDays(), 30);
  delete process.env.ATTENDANCE_CORRECTION_WINDOW_DAYS;
  assert.throws(() => assertNotFutureDate('2026-11-05', now), /future/);
  assert.doesNotThrow(() => assertNotFutureDate('2026-11-01', now), 'one day of timezone slack');
});
