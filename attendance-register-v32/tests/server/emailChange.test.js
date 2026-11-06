import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';

// Same bootstrap as tests/server/security.test.js: no live MongoDB is
// available in this environment, so these tests cover what's genuinely
// verifiable without one - HTTP-boundary behaviour that never reaches the
// database (auth/validation rejection paths), schema-level checks that
// don't require a connection, and static source assertions that pin down
// the exact contract the fix relies on. Anything that requires a live
// round trip (a real OTP being generated, matched, and consumed against a
// persisted user) is out of scope here for the same reason it's out of
// scope for the rest of the suite, and is called out in the final report.

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
process.env.CLIENT_URL = 'http://allowed.example.test';
process.env.ALLOWED_ORIGINS = 'http://allowed.example.test';
process.env.RATE_LIMIT_MAX_REQUESTS = '300';

const { default: app } = await import('../../server/src/app.js');
const { OTP_PURPOSE } = await import('../../server/src/config/constants.js');
const { User, Otp } = await import('../../server/src/models/index.js');

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

async function postJson(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

test('OTP_PURPOSE registers a distinct email_change purpose', () => {
  assert.equal(OTP_PURPOSE.EMAIL_CHANGE, 'email_change');
  const values = Object.values(OTP_PURPOSE);
  assert.equal(new Set(values).size, values.length, 'purposes must be unique');
});

test('the Otp schema accepts the email_change purpose without a live database', async () => {
  const doc = new Otp({
    email: 'new-address@example.test',
    codeHash: 'placeholder-hash',
    purpose: OTP_PURPOSE.EMAIL_CHANGE,
    expiresAt: new Date(Date.now() + 60_000),
  });
  await assert.doesNotReject(doc.validate());
});

test('the Otp schema still rejects purposes outside the enum', async () => {
  const doc = new Otp({
    email: 'new-address@example.test',
    codeHash: 'placeholder-hash',
    purpose: 'not_a_real_purpose',
    expiresAt: new Date(Date.now() + 60_000),
  });
  await assert.rejects(doc.validate());
});

test('User.pendingEmail normalizes case/whitespace the same way email does, and stays out of the default projection', () => {
  const modelSource = fs.readFileSync(new URL('../../server/src/models/User.js', import.meta.url), 'utf8');
  assert.match(modelSource, /pendingEmail:\s*\{[^}]*select: false/s);
  assert.match(modelSource, /pendingEmail:\s*\{[^}]*lowercase: true/s);

  const user = new User({
    name: 'Pending Email Test',
    email: 'current@example.test',
    role: 'student',
    passwordResetRequired: true,
    pendingEmail: '  New-Address@Example.TEST  ',
  });
  assert.equal(user.pendingEmail, 'new-address@example.test');
});

test('email-change endpoints require authentication before touching the database', async () => {
  const requestRes = await postJson('/api/auth/me/email-change', { newEmail: 'someone@example.test' });
  assert.equal(requestRes.status, 401);

  const confirmRes = await postJson('/api/auth/me/email-change/confirm', { otp: '123456' });
  assert.equal(confirmRes.status, 401);

  const cancelRes = await postJson('/api/auth/me/email-change/cancel', {});
  assert.equal(cancelRes.status, 401);
});

test('the general profile-update endpoint no longer accepts an email field', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'someone@example.test' }),
  });
  // No token is supplied, so `protect` rejects the request before it
  // reaches validation - but the source assertions below are what
  // actually prove `email` was removed from this endpoint's contract,
  // since a 401 here would also occur for a route that still accepted it.
  assert.equal(res.status, 401);

  const routesSource = fs.readFileSync(new URL('../../server/src/routes/authRoutes.js', import.meta.url), 'utf8');
  const meRouteLine = routesSource.split('\n').find((line) => line.includes("patch('/me'"));
  assert.ok(meRouteLine, 'PATCH /me route should exist');
  assert.doesNotMatch(meRouteLine, /'email'/);

  const validatorsSource = fs.readFileSync(new URL('../../server/src/validators/authValidators.js', import.meta.url), 'utf8');
  const updateMeBlock = validatorsSource.slice(
    validatorsSource.indexOf('export const updateMeValidator'),
    validatorsSource.indexOf('export const changePasswordValidator'),
  );
  assert.doesNotMatch(updateMeBlock, /body\('email'\)/);
});

test('requesting an email change is rate-limited the same way other OTP-generating endpoints are, and confirming is rate-limited like OTP verification', () => {
  const routesSource = fs.readFileSync(new URL('../../server/src/routes/authRoutes.js', import.meta.url), 'utf8');
  const requestLine = routesSource.split('\n').find((line) => line.includes("/me/email-change'"));
  const confirmLine = routesSource.split('\n').find((line) => line.includes("/me/email-change/confirm'"));
  const cancelLine = routesSource.split('\n').find((line) => line.includes("/me/email-change/cancel'"));

  assert.match(requestLine, /otpGenerateLimiter/);
  assert.match(confirmLine, /otpVerifyLimiter/);
  assert.ok(cancelLine, 'cancel route should exist');

  // All three must be registered after router.use(protect) - never public.
  const protectIndex = routesSource.indexOf('router.use(protect)');
  assert.ok(protectIndex >= 0);
  for (const line of [requestLine, confirmLine, cancelLine]) {
    assert.ok(routesSource.indexOf(line) > protectIndex, `${line} must be registered after protect`);
  }
});

test('the email-change flow verifies the new address before applying it and notifies the old address at request time', () => {
  const authSource = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');

  // The old vulnerable shape - updateMe setting user.email straight from
  // client input and marking it verified with no proof of ownership -
  // must not be present anywhere in the file any more.
  assert.doesNotMatch(authSource, /if \(email !== undefined\)/);

  assert.match(authSource, /export const requestEmailChange/);
  assert.match(authSource, /export const confirmEmailChange/);
  assert.match(authSource, /export const cancelEmailChange/);

  // requestEmailChange: stores the target as pending and emails an OTP to
  // it rather than writing straight to `email`.
  const requestBody = authSource.slice(authSource.indexOf('export const requestEmailChange'), authSource.indexOf('export const confirmEmailChange'));
  assert.match(requestBody, /user\.pendingEmail = normalizedEmail/);
  assert.match(requestBody, /createOtp\(normalizedEmail, OTP_PURPOSE\.EMAIL_CHANGE\)/);
  assert.match(requestBody, /sendEmailChangeRequestedNoticeSafely/);
  assert.doesNotMatch(requestBody, /user\.email = normalizedEmail/);

  // confirmEmailChange: only writes `email` after verifyOtp succeeds, and
  // re-checks uniqueness to close the window-of-verification race.
  const confirmBody = authSource.slice(authSource.indexOf('export const confirmEmailChange'), authSource.indexOf('export const cancelEmailChange'));
  assert.match(confirmBody, /verifyOtp\(user\.pendingEmail, OTP_PURPOSE\.EMAIL_CHANGE, otp\)/);
  assert.match(confirmBody, /if \(!result\.valid\)/);
  assert.match(confirmBody, /User\.exists\(\{ email: user\.pendingEmail/);
  assert.match(confirmBody, /user\.email = user\.pendingEmail/);

  const emailSource = fs.readFileSync(new URL('../../server/src/utils/email.js', import.meta.url), 'utf8');
  assert.match(emailSource, /export async function sendEmailChangeRequestedNotice/);
});
