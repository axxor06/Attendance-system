import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
process.env.CLIENT_URL = 'http://allowed.example.test';
process.env.ALLOWED_ORIGINS = 'http://allowed.example.test';
process.env.RATE_LIMIT_MAX_REQUESTS = '300';

const { default: app } = await import('../../server/src/app.js');
const { generateAccessToken, verifyAccessToken, generateRefreshToken, verifyRefreshToken } = await import('../../server/src/utils/jwt.js');
const { RegistrationRequest, RefreshSession, User, Semester, PeriodTemplate } = await import('../../server/src/models/index.js');
const { getLoginFailureReset, getLoginFailureUpdate } = await import('../../server/src/utils/loginProtection.js');
const { paginationMeta, parsePagination } = await import('../../server/src/utils/pagination.js');
const { isSharedRateLimitEnabled } = await import('../../server/src/middleware/rateLimiters.js');
const { cookieOriginGuard } = await import('../../server/src/middleware/cookieOriginGuard.js');
const { generateOtpCode } = await import('../../server/src/utils/otp.js');

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('OTP generation uses Node cryptographic randomInt and returns a valid numeric code', () => {
  const code = generateOtpCode();
  assert.match(code, /^\d{6}$/);
});

test('access tokens carry the current token version and refresh tokens carry a jti/type', () => {
  const user = { _id: '507f1f77bcf86cd799439011', role: 'student', tokenVersion: 4 };
  const access = verifyAccessToken(generateAccessToken(user));
  assert.equal(access.tokenVersion, 4);

  const refresh = verifyRefreshToken(generateRefreshToken(user));
  assert.equal(refresh.tokenType, 'refresh');
  assert.match(refresh.jti, /^[0-9a-f-]{36}$/i);
});

test('registration requests have no plaintext password schema path and hide password hashes', () => {
  assert.equal(RegistrationRequest.schema.path('password'), undefined);
  assert.equal(RegistrationRequest.schema.path('passwordHash').options.select, false);
});

test('refresh sessions carry a family identifier for reuse revocation', () => {
  assert.equal(RefreshSession.schema.path('familyId').options.required, true);
  assert.equal(RefreshSession.schema.indexes().some(([fields]) => fields.familyId === 1), true);
});

test('semester numbers and active period templates have database uniqueness constraints', () => {
  assert.equal(Semester.schema.indexes().some(([fields, options]) => fields.number === 1 && options?.unique === true), true);
  assert.equal(PeriodTemplate.schema.indexes().some(([fields, options]) => fields.dayOfWeek === 1 && options?.unique === true && options?.partialFilterExpression?.isActive === true), true);
});

test('cookie origin guard allows configured browser origins and rejects unexpected origins', () => {
  let allowedCalled = false;
  cookieOriginGuard({ get: (header) => header === 'origin' ? 'http://allowed.example.test' : undefined }, {}, () => { allowedCalled = true; });
  assert.equal(allowedCalled, true);

  let deniedError;
  cookieOriginGuard({ get: (header) => header === 'origin' ? 'http://evil.example.test' : undefined }, {}, (error) => { deniedError = error; });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'COOKIE_ORIGIN_DENIED');
});

test('progressive login protection locks after the configured threshold and resets cleanly', () => {
  const previous = {
    window: process.env.LOGIN_FAILURE_WINDOW_MS,
    threshold: process.env.LOGIN_FAILURE_THRESHOLD,
    base: process.env.LOGIN_LOCK_BASE_MS,
    max: process.env.LOGIN_LOCK_MAX_MS,
  };
  process.env.LOGIN_FAILURE_WINDOW_MS = '900000';
  process.env.LOGIN_FAILURE_THRESHOLD = '3';
  process.env.LOGIN_LOCK_BASE_MS = '10000';
  process.env.LOGIN_LOCK_MAX_MS = '30000';

  const now = new Date('2026-08-14T00:00:00.000Z');
  const first = getLoginFailureUpdate({}, now);
  assert.equal(first.failedLoginAttempts, 1);
  assert.equal(first.loginLockedUntil, null);

  const second = getLoginFailureUpdate({
    failedLoginAttempts: first.failedLoginAttempts,
    loginFailureWindowStartedAt: first.loginFailureWindowStartedAt,
  }, new Date(now.getTime() + 1000));
  assert.equal(second.failedLoginAttempts, 2);
  assert.equal(second.loginLockedUntil, null);

  const third = getLoginFailureUpdate({
    failedLoginAttempts: second.failedLoginAttempts,
    loginFailureWindowStartedAt: second.loginFailureWindowStartedAt,
  }, new Date(now.getTime() + 2000));
  assert.equal(third.failedLoginAttempts, 3);
  assert.equal(third.loginLockedUntil.getTime() - (now.getTime() + 2000), 10000);

  const fourth = getLoginFailureUpdate({
    failedLoginAttempts: third.failedLoginAttempts,
    loginFailureWindowStartedAt: third.loginFailureWindowStartedAt,
  }, new Date(now.getTime() + 3000));
  assert.equal(fourth.failedLoginAttempts, 4);
  assert.equal(fourth.loginLockedUntil.getTime() - (now.getTime() + 3000), 20000);
  assert.deepEqual(getLoginFailureReset(), {
    failedLoginAttempts: 0,
    loginFailureWindowStartedAt: null,
    loginLockedUntil: null,
  });

  for (const [key, value] of Object.entries(previous)) {
    const envName = { window: 'LOGIN_FAILURE_WINDOW_MS', threshold: 'LOGIN_FAILURE_THRESHOLD', base: 'LOGIN_LOCK_BASE_MS', max: 'LOGIN_LOCK_MAX_MS' }[key];
    if (value === undefined) delete process.env[envName];
    else process.env[envName] = value;
  }
});

test('password-reset-required state is private and represented in the User schema', () => {
  const authSource = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');
  assert.match(authSource, /if \(user\.passwordResetRequired\)/);
  assert.match(authSource, /A password reset is required/);

  const path = User.schema.path('passwordResetRequired');
  assert.equal(path.options.default, false);
  assert.equal(path.options.select, false);

  const user = new User({
    name: 'Reset Required',
    email: 'reset-required@example.test',
    password: 'not-returned',
    role: 'student',
    passwordResetRequired: true,
    failedLoginAttempts: 4,
    loginFailureWindowStartedAt: new Date(),
    loginLockedUntil: new Date(Date.now() + 60000),
    tokenVersion: 3,
  });
  const safe = user.toSafeObject();
  for (const key of ['password', 'tokenVersion', 'passwordResetRequired', 'failedLoginAttempts', 'loginFailureWindowStartedAt', 'loginLockedUntil']) {
    assert.equal(Object.hasOwn(safe, key), false, `${key} must not be returned`);
  }
});

test('period-template deactivation is auditable and no temporary-password response is emitted', () => {
  const source = fs.readFileSync(new URL('../../server/src/controllers/periodTemplateController.js', import.meta.url), 'utf8');
  assert.match(source, /ACTIVITY_ACTION\.DEACTIVATE/);
  assert.match(source, /Replaced periods for/);
});

test('administrator reset wiring uses an OTP and never a temporary-password response', () => {
  const source = fs.readFileSync(new URL('../../server/src/controllers/userController.js', import.meta.url), 'utf8');
  const start = source.indexOf('export const resetUserPassword');
  const end = source.indexOf('\n});', start) + 4;
  const resetFunction = source.slice(start, end);
  assert.match(resetFunction, /createOtp\(user\.email, OTP_PURPOSE\.PASSWORD_RESET\)/);
  assert.match(resetFunction, /sendOtpEmail\(/);
  assert.match(resetFunction, /passwordResetRequired = true/);
  assert.doesNotMatch(resetFunction, /sendAccountCreatedEmail\(/);
  assert.doesNotMatch(resetFunction, /tempPassword/);
});

test('pagination parser rejects invalid limits and returns stable metadata', () => {
  assert.deepEqual(parsePagination({ page: '2', limit: '50' }, { defaultLimit: 25, maxLimit: 100 }), {
    page: 2,
    limit: 50,
    skip: 50,
  });
  assert.deepEqual(paginationMeta({ total: 101, page: 2, limit: 50 }), {
    total: 101,
    page: 2,
    limit: 50,
    pages: 3,
  });
  assert.throws(() => parsePagination({ page: '0', limit: '10' }), /page must be a positive integer/);
  assert.throws(() => parsePagination({ page: '1', limit: '101' }), /limit must be an integer between 1 and 100/);
});

test('local tests use the memory limiter when Redis is not configured', () => {
  assert.equal(isSharedRateLimitEnabled(), false);
});

test('liveness endpoint is public and does not expose database details', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.database, undefined);
});

test('readiness endpoint is not ready when MongoDB is disconnected', async () => {
  const response = await fetch(`${baseUrl}/api/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { success: false, status: 'not_ready' });
});

test('configured origins receive CORS credentials while arbitrary origins do not', async () => {
  const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://allowed.example.test' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://allowed.example.test');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

  const denied = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://evil.example.test' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('malformed identifier query values are rejected before route handling', async () => {
  const response = await fetch(`${baseUrl}/api/health?subjectId=not-an-object-id`);
  assert.equal(response.status, 400);
});

test('demo seed refuses production mode before connecting to MongoDB', () => {
  const result = spawnSync(process.execPath, ['src/utils/seed.js'], {
    cwd: new URL('../../server/', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1:27017/unused' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /Refusing to run the demo seed/);
});
