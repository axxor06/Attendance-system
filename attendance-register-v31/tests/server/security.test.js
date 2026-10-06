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
const { Conversation, Message, RegistrationRequest, RefreshSession, User, Semester, PeriodTemplate } = await import('../../server/src/models/index.js');
const { canonicalRole, roleValues, ROLE_LIST, ROLES } = await import('../../server/src/config/constants.js');
const { getLoginFailureReset, getLoginFailureUpdate } = await import('../../server/src/utils/loginProtection.js');
const { paginationMeta, parsePagination } = await import('../../server/src/utils/pagination.js');
const { isSharedRateLimitEnabled } = await import('../../server/src/middleware/rateLimiters.js');
const { cookieOriginGuard } = await import('../../server/src/middleware/cookieOriginGuard.js');
const { rejectUnknownBodyFields } = await import('../../server/src/middleware/strictBody.js');
const { generateOtpCode } = await import('../../server/src/utils/otp.js');
const { applyDepartmentScope, allowedUserCreationRoles, assertManageableUser } = await import('../../server/src/utils/authorization.js');
const { isConcurrentRotationGraceEligible } = await import('../../server/src/utils/refreshSession.js');
const { isValidDateOnly, calculateAge } = await import('../../server/src/utils/dateOfBirth.js');
const { hashDeviceId, normalizeDeviceId } = await import('../../server/src/utils/deviceBinding.js');
const { isAllowedProfileImageUrl, validateProfileImage } = await import('../../server/src/services/imagekitService.js');
const { assertSecurityConfiguration } = await import('../../server/src/config/security.js');

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

test('managed accounts use an explicit password or an emailed setup-code flow', async () => {
  const controller = fs.readFileSync(new URL('../../server/src/controllers/userController.js', import.meta.url), 'utf8');
  const authSource = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');
  const userSource = fs.readFileSync(new URL('../../server/src/models/User.js', import.meta.url), 'utf8');
  assert.doesNotMatch(controller, /randomBytes/);
  assert.match(controller, /password: password \|\| undefined/);
  assert.match(controller, /credentialMode/);
  assert.match(controller, /Otp\.deleteMany/);
  assert.match(controller, /The account was not created/);
  assert.match(controller, /passwordResetRequired: true/);
  assert.match(authSource, /requiresPasswordChange: Boolean\(user\.passwordResetRequired\)/);
  assert.match(userSource, /passwordRequired\(\)/);
  assert.match(userSource, /bcrypt\.hash\(this\.password/);
  assert.match(userSource, /if \(!this\.password \|\| !candidate\)/);
  assert.match(userSource, /delete obj\.password/);
  assert.match(userSource, /delete obj\.passwordResetRequired/);

  const setupAccount = new User({
    name: 'Setup Account',
    email: 'setup-account@example.test',
    role: 'student',
    passwordResetRequired: true,
  });
  await setupAccount.validate();
  assert.equal(setupAccount.password, undefined);

  const permanentAccount = new User({
    name: 'Permanent Account',
    email: 'permanent-account@example.test',
    role: 'student',
    passwordResetRequired: false,
  });
  await assert.rejects(permanentAccount.validate(), /Password is required/);
});

test('QR sessions store only token digests and apply QR-specific abuse limits', () => {
  const modelSource = fs.readFileSync(new URL('../../server/src/models/QrSession.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../../server/src/controllers/qrController.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../../server/src/routes/qrRoutes.js', import.meta.url), 'utf8');
  assert.match(modelSource, /select: false/);
  assert.match(controller, /createHash\('sha256'\)/);
  assert.match(controller, /token: hashQrToken\(rawToken\)/);
  assert.match(controller, /token: hashQrToken\(normalizedToken\)/);
  assert.match(routes, /qrGenerateLimiter/);
  assert.match(routes, /qrScanLimiter/);
});

test('Redis-backed limiters use isolated stores and startup connects Redis before app import', () => {
  const limiterSource = fs.readFileSync(new URL('../../server/src/middleware/rateLimiters.js', import.meta.url), 'utf8');
  const serverSource = fs.readFileSync(new URL('../../server/src/server.js', import.meta.url), 'utf8');
  assert.match(limiterSource, /function createRedisStore\(name\)/);
  assert.match(limiterSource, /prefix: `attendance-register:rate-limit:\$\{name\.toLowerCase\(\)\}:`/);
  assert.match(limiterSource, /const store = createRedisStore\(name\)/);
  assert.match(serverSource, /await connectRedis\(\);\s*const \{ default: app \} = await import\('\.\/app\.js'\);/s);
});

test('attendance marking has a dedicated user-aware abuse limit', () => {
  const limiterSource = fs.readFileSync(new URL('../../server/src/middleware/rateLimiters.js', import.meta.url), 'utf8');
  const routesSource = fs.readFileSync(new URL('../../server/src/routes/attendanceRoutes.js', import.meta.url), 'utf8');
  const authRoutesSource = fs.readFileSync(new URL('../../server/src/routes/authRoutes.js', import.meta.url), 'utf8');
  assert.match(limiterSource, /RATE_LIMIT_ATTENDANCE_SUBMIT_MAX/);
  assert.match(limiterSource, /RATE_LIMIT_PASSWORD_CHANGE_MAX/);
  assert.match(limiterSource, /keyType: 'user'/);
  assert.match(routesSource, /attendanceSubmitLimiter/);
  assert.match(authRoutesSource, /passwordChangeLimiter/);
});

test('refresh rotation grace distinguishes a recent replacement from an old replay', () => {
  const now = new Date('2026-08-20T00:00:02.000Z');
  const recent = {
    tokenHash: 'digest',
    revokedAt: new Date('2026-08-20T00:00:01.000Z'),
    lastUsedAt: new Date('2026-08-20T00:00:01.500Z'),
    replacedByJti: 'descendant-jti',
    expiresAt: new Date('2026-08-21T00:00:00.000Z'),
  };
  assert.equal(isConcurrentRotationGraceEligible(recent, 'digest', now), true);
  assert.equal(isConcurrentRotationGraceEligible({ ...recent, lastUsedAt: new Date('2026-08-19T23:59:00.000Z') }, 'digest', now), false);
  assert.equal(isConcurrentRotationGraceEligible(recent, 'different-digest', now), false);
  assert.equal(isConcurrentRotationGraceEligible({ ...recent, replacedByJti: null }, 'digest', now), false);
});

test('canonical role model maps public college roles without exposing legacy values', () => {
  assert.deepEqual(ROLE_LIST, ['super_admin', 'admin', 'user']);
  assert.equal(canonicalRole('hod'), ROLES.SUPER_ADMIN);
  assert.equal(canonicalRole('faculty'), ROLES.ADMIN);
  assert.equal(canonicalRole('student'), ROLES.USER);
  assert.deepEqual(roleValues(ROLES.USER), ['user', 'student']);
  assert.deepEqual(roleValues(ROLES.ADMIN), ['admin', 'faculty']);
  const userSource = fs.readFileSync(new URL('../../server/src/models/User.js', import.meta.url), 'utf8');
  assert.match(userSource, /enum: ALL_ACCEPTED_ROLE_LIST/);
  assert.match(userSource, /obj\.role = canonicalRole/);
  assert.equal(User.schema.path('roleModelVersion').options.select, false);
});

test('access tokens carry the current token version and refresh tokens carry a jti/type', () => {
  const user = { _id: '507f1f77bcf86cd799439011', role: 'student', tokenVersion: 4 };
  const access = verifyAccessToken(generateAccessToken(user));
  assert.equal(access.tokenVersion, 4);

  const refresh = verifyRefreshToken(generateRefreshToken(user));
  assert.equal(refresh.tokenType, 'refresh');
  assert.match(refresh.jti, /^[0-9a-f-]{36}$/i);
});

test('date of birth is date-only, future-safe, and age is derived dynamically', () => {
  assert.equal(isValidDateOnly('2000-02-29'), true);
  assert.equal(isValidDateOnly('2000-02-30'), false);
  assert.equal(isValidDateOnly('2999-01-01'), false);
  assert.equal(calculateAge('2000-08-20', new Date('2026-08-20T12:00:00.000Z')), 26);
  assert.equal(calculateAge('2000-08-21', new Date('2026-08-20T12:00:00.000Z')), 25);
  assert.equal(User.schema.path('dateOfBirth').options.default, null);
  assert.equal(User.schema.path('age'), undefined);
});

test('profile uploads require validated image bytes and configured ImageKit URLs', () => {
  const previous = {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    endpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  };
  process.env.IMAGEKIT_PUBLIC_KEY = 'public-test-key';
  process.env.IMAGEKIT_PRIVATE_KEY = 'private-test-key';
  process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/attendance-test';
  assert.equal(isAllowedProfileImageUrl('https://ik.imagekit.io/attendance-test/profiles/avatar.jpg'), true);
  assert.equal(isAllowedProfileImageUrl('https://evil.example/avatar.jpg'), false);
  assert.equal(isAllowedProfileImageUrl('http://ik.imagekit.io/attendance-test/avatar.jpg'), false);
  assert.equal(validateProfileImage({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), size: 4, mimetype: 'image/jpeg' }).ok, true);
  assert.equal(validateProfileImage({ buffer: Buffer.from('<script>'), size: 8, mimetype: 'image/jpeg' }).ok, false);
  assert.equal(validateProfileImage({ buffer: Buffer.alloc(3 * 1024 * 1024 + 1), size: 1, mimetype: 'image/jpeg' }).ok, false);
  const imageService = fs.readFileSync(new URL('../../server/src/services/imagekitService.js', import.meta.url), 'utf8');
  assert.match(imageService, /return \{ url: uploaded\.url \}/);
  if (previous.publicKey === undefined) delete process.env.IMAGEKIT_PUBLIC_KEY; else process.env.IMAGEKIT_PUBLIC_KEY = previous.publicKey;
  if (previous.privateKey === undefined) delete process.env.IMAGEKIT_PRIVATE_KEY; else process.env.IMAGEKIT_PRIVATE_KEY = previous.privateKey;
  if (previous.endpoint === undefined) delete process.env.IMAGEKIT_URL_ENDPOINT; else process.env.IMAGEKIT_URL_ENDPOINT = previous.endpoint;
});

test('registration requests use hashed status capabilities without plaintext credentials', () => {
  assert.equal(RegistrationRequest.schema.path('password'), undefined);
  assert.equal(RegistrationRequest.schema.path('passwordHash').options.select, false);
  assert.equal(RegistrationRequest.schema.path('statusTokenHash').options.select, false);
  assert.equal(RegistrationRequest.schema.path('statusCodeHash').options.select, false);
  assert.ok(RegistrationRequest.schema.path('statusTokenExpiresAt'));
  assert.equal(RegistrationRequest.schema.indexes().some(([fields, options]) => fields.statusCodeHash === 1 && options?.unique === true && options?.sparse === true), true);
  const controllerSource = fs.readFileSync(new URL('../../server/src/controllers/registrationRequestController.js', import.meta.url), 'utf8');
  const routeSource = fs.readFileSync(new URL('../../server/src/routes/registrationRequestRoutes.js', import.meta.url), 'utf8');
  assert.match(controllerSource, /statusCodeHash: hashStatusToken/);
  assert.match(controllerSource, /mongoose\.isValidObjectId\(requestId\)/);
  assert.match(controllerSource, /STATUS_CODE_PATTERN/);
  assert.match(routeSource, /AR-\[A-Z0-9\]\{4\}/);
  assert.match(routeSource, /Enter your status reference/);
});

test('refresh sessions carry a family identifier for reuse revocation', () => {
  assert.equal(RefreshSession.schema.path('familyId').options.required, true);
  assert.equal(RefreshSession.schema.indexes().some(([fields]) => fields.familyId === 1), true);
});

test('refresh controller keeps rotation atomic and reuse detection intact', () => {
  const authController = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');
  assert.match(authController, /const tokenHash = hashRefreshToken\(token\)/);
  assert.match(authController, /canUseConcurrentRefreshGrace\(observedSession, tokenHash, familyId, now\)/);
  assert.match(authController, /findOneAndUpdate\(\s*\{\s*_id: observedSession\._id,\s*tokenHash,\s*revokedAt: null/);
  assert.match(authController, /replacedByJti: nextDecoded\.jti/);
  assert.match(authController, /revokeRefreshFamily\(familyId\)/);
  assert.match(authController, /Refresh session reuse detected\. Please log in again\./);
});

test('current-user profile responses include nested semester metadata without private fields', () => {
  const authSource = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');
  const userSource = fs.readFileSync(new URL('../../server/src/models/User.js', import.meta.url), 'utf8');
  assert.equal((authSource.match(/path: 'class', select: 'name code semester'/g) || []).length, 3);
  assert.match(authSource, /path: 'semester', select: 'name number'/);
  assert.match(userSource, /delete obj\.passwordResetRequired/);
});

test('semester numbers and active period templates have database uniqueness constraints', () => {
  assert.equal(Semester.schema.indexes().some(([fields, options]) => fields.number === 1 && options?.unique === true), true);
  assert.equal(PeriodTemplate.schema.indexes().some(([fields, options]) => fields.dayOfWeek === 1 && options?.unique === true && options?.partialFilterExpression?.isActive === true), true);
});

test('student device binding uses opaque hashes and authorized reset wiring', () => {
  const userSource = fs.readFileSync(new URL('../../server/src/models/User.js', import.meta.url), 'utf8');
  const authSource = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');
  const authMiddleware = fs.readFileSync(new URL('../../server/src/middleware/auth.js', import.meta.url), 'utf8');
  const userController = fs.readFileSync(new URL('../../server/src/controllers/userController.js', import.meta.url), 'utf8');
  const userRoutes = fs.readFileSync(new URL('../../server/src/routes/userRoutes.js', import.meta.url), 'utf8');
  const appSource = fs.readFileSync(new URL('../../server/src/app.js', import.meta.url), 'utf8');
  assert.equal(User.schema.path('deviceBindingHash').options.select, false);
  assert.ok(User.schema.path('deviceBoundAt'));
  assert.equal(User.schema.indexes().some(([fields, options]) => fields.deviceBindingHash === 1 && options?.sparse === true), true);
  assert.match(authSource, /bindOrVerifyStudentDevice/);
  assert.match(authMiddleware, /bindOrVerifyStudentDevice/);
  assert.match(userController, /resetStudentDevice/);
  assert.match(userRoutes, /reset-device/);
  assert.match(appSource, /X-Device-Id/);
  assert.equal(normalizeDeviceId('short'), null);
  assert.equal(normalizeDeviceId('device-identifier-1234567890'), 'device-identifier-1234567890');
  assert.match(hashDeviceId('device-identifier-1234567890'), /^[a-f0-9]{64}$/);
  assert.match(userSource, /delete obj\.deviceBindingHash/);
});

test('registration, profile, and role-request contracts remain explicit', () => {
  const authController = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');
  const authRoutes = fs.readFileSync(new URL('../../server/src/routes/authRoutes.js', import.meta.url), 'utf8');
  const requestModel = fs.readFileSync(new URL('../../server/src/models/RegistrationRequest.js', import.meta.url), 'utf8');
  const requestController = fs.readFileSync(new URL('../../server/src/controllers/registrationRequestController.js', import.meta.url), 'utf8');
  const requestRoutes = fs.readFileSync(new URL('../../server/src/routes/registrationRequestRoutes.js', import.meta.url), 'utf8');
  const departmentRoutes = fs.readFileSync(new URL('../../server/src/routes/departmentRoutes.js', import.meta.url), 'utf8');
  assert.match(authController, /loadSafeAuthUser/);
  const userController = fs.readFileSync(new URL('../../server/src/controllers/userController.js', import.meta.url), 'utf8');
  const authValidators = fs.readFileSync(new URL('../../server/src/validators/authValidators.js', import.meta.url), 'utf8');
  assert.match(authController, /Student profile photos are set during registration/);
  assert.match(authController, /employeeId !== undefined/);
  assert.match(authController, /ApiError\.emailAlreadyExists/);
  assert.doesNotMatch(authRoutes, /router\.post\('\/register'/);
  assert.match(requestModel, /REGISTRATION_REQUEST_ROLE_LIST/);
  assert.match(requestModel, /default: ROLES\.USER/);
  assert.match(requestModel, /employeeId/);
  assert.match(requestModel, /assignedIdentifier/);
  assert.match(requestModel, /department: \{ type: Schema\.Types\.ObjectId, ref: 'Department'/);
  assert.match(requestController, /requestedRole = ROLES\.STUDENT/);
  assert.match(requestController, /isFacultyRequest/);
  assert.match(requestController, /role: isFacultyRequest \? ROLES\.FACULTY : ROLES\.STUDENT/);
  assert.match(requestController, /identifierFieldFor/);
  assert.match(requestController, /User\.exists\(\{ \[identifierField\]: identifier \}\)/);
  assert.match(requestController, /findOneAndUpdate\(/);
  assert.match(requestController, /assignedIdentifier: identifier/);
  assert.match(requestRoutes, /body\('identifier'\)/);
  assert.match(requestRoutes, /Register number is assigned by the HOD/);
  assert.match(requestRoutes, /Employee ID is assigned by the HOD/);
  assert.match(requestRoutes, /min: 5, max: 500/);
  assert.match(departmentRoutes, /public-options/);
  assert.match(userController, /Only an authorized HOD can change register or employee IDs/);
  assert.match(authValidators, /body\('employeeId'\)/);
});

test('photo uploads and all-error responses remain bounded and safe', () => {
  const uploadService = fs.readFileSync(new URL('../../server/src/services/imagekitService.js', import.meta.url), 'utf8');
  const uploadRoutes = fs.readFileSync(new URL('../../server/src/routes/uploadRoutes.js', import.meta.url), 'utf8');
  const errorHandler = fs.readFileSync(new URL('../../server/src/middleware/errorHandler.js', import.meta.url), 'utf8');
  const appSource = fs.readFileSync(new URL('../../server/src/app.js', import.meta.url), 'utf8');
  assert.match(uploadService, /3 \* 1024 \* 1024/);
  assert.match(uploadService, /IMAGEKIT_PRIVATE_KEY/);
  assert.match(uploadService, /magic|detectedType|subarray/);
  assert.match(uploadRoutes, /memoryStorage/);
  assert.match(uploadRoutes, /fileSize: 3 \* 1024 \* 1024/);
  assert.match(errorHandler, /Something went wrong on the server/);
  assert.doesNotMatch(errorHandler, /stack:/);
  assert.match(appSource, /Attendance Register API/);
  assert.doesNotMatch(appSource, /Attendance Register API v\d/);
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

test('HOD has institution-wide control while Faculty remains teaching-scoped', async () => {
  const departmentA = '507f1f77bcf86cd799439011';
  const departmentB = '507f1f77bcf86cd799439012';
  const hod = { _id: '507f1f77bcf86cd799439013', role: 'hod', department: departmentA };
  assert.deepEqual(applyDepartmentScope({ user: hod }, { isActive: true }), { isActive: true });
  assert.deepEqual(allowedUserCreationRoles(hod), ['admin', 'user']);
  await assert.doesNotReject(assertManageableUser(hod, { _id: '507f1f77bcf86cd799439014', role: 'student', department: departmentB }));
  await assert.rejects(
    assertManageableUser({ _id: 'faculty-id', role: 'admin' }, { _id: 'student-id', role: 'user' }),
    /Only an authorized HOD/,
  );
  await assert.rejects(
    assertManageableUser(hod, { _id: hod._id, role: 'hod', department: departmentA }),
    /own account/,
  );
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
  assert.match(authSource, /requiresPasswordChange: Boolean\(user\.passwordResetRequired\)/);

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

test('administrator reset wiring uses a one-time permanent credential response', () => {
  const source = fs.readFileSync(new URL('../../server/src/controllers/userController.js', import.meta.url), 'utf8');
  const start = source.indexOf('export const resetUserPassword');
  const end = source.indexOf('\n});', start) + 4;
  const resetFunction = source.slice(start, end);
  assert.match(resetFunction, /generatePermanentCredential\(\)/);
  assert.match(resetFunction, /user\.password = permanentPassword/);
  assert.match(resetFunction, /passwordResetRequired = false/);
  assert.match(resetFunction, /resetCredential: permanentPassword/);
  assert.match(resetFunction, /passwordIsPermanent: true/);
  assert.match(resetFunction, /revokeUserSessions\(user\._id\)/);
  assert.doesNotMatch(resetFunction, /sendOtpEmail\(/);
  assert.doesNotMatch(resetFunction, /sendAccountCreatedEmail\(/);
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

test('liveness endpoint is public and reports safe database availability', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(['connected', 'disconnected'].includes(body.database), true);
  assert.equal(['connected', 'disconnected', 'not_configured'].includes(body.redis), true);
  assert.equal(body.stack, undefined);
  assert.equal(body.password, undefined);
});

test('readiness endpoint is not ready when MongoDB is disconnected', async () => {
  const response = await fetch(`${baseUrl}/api/ready`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { success: false, status: 'not_ready', database: 'disconnected', redis: 'not_configured' });
});

test('Docker and seed release wiring use internal service names and scaled fixtures', () => {
  const root = new URL('../../', import.meta.url);
  const compose = fs.readFileSync(new URL('../../docker-compose.yml', import.meta.url), 'utf8');
  const clientDockerfile = fs.readFileSync(new URL('../../client/Dockerfile', import.meta.url), 'utf8');
  const nginx = fs.readFileSync(new URL('../../client/nginx.conf', import.meta.url), 'utf8');
  const seed = fs.readFileSync(new URL('../../server/src/utils/seed.js', import.meta.url), 'utf8');
  assert.match(compose, /MONGO_URI:\s*mongodb:\/\/mongo:/);
  assert.doesNotMatch(compose, /host\.docker\.internal/);
  assert.match(clientDockerfile, /ARG VITE_API_BASE_URL=\/api/);
  assert.match(nginx, /location \/api\//);
  assert.match(nginx, /proxy_pass http:\/\/server:5000/);
  assert.match(seed, /const FACULTY_TARGET_PER_DEPARTMENT = 20/);
  assert.match(seed, /const required = FACULTY_TARGET_PER_DEPARTMENT - current\.length/);
  assert.match(seed, /const facultyByDept = \{\}/);
  assert.match(seed, /const target = randInt\(55, 60\)/);
  assert.match(seed, /`Students: \$\{studentAdded\} new`/);
  assert.match(seed, /col\('timetables'\)\.updateOne/);
  assert.match(seed, /Timetables are ALWAYS rebuilt conflict-free/);
  assert.match(seed, /nextSeededRandom/);
  assert.doesNotMatch(seed, /Math\.random\(\)/);
  for (const name of ['Computer Science', 'Electronics & Communication', 'Mechanical Engineering', 'Civil Engineering', 'Electrical & Electronics Engineering', 'Artificial Intelligence & Data Science', 'Automobile Engineering', 'Mechatronics Engineering', 'Aeronautical Engineering', 'Instrumentation & Control Engineering']) assert.match(seed, new RegExp(name.replace(/[&]/g, '\\&')));
  const openapi = fs.readFileSync(new URL('../../docs/openapi.yaml', import.meta.url), 'utf8');
  assert.match(openapi, /\/users\/\{id\}\/summary/);
  assert.match(openapi, /\/users\/\{id\}\/reset-device/);
  void root;
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

test('seed generates classes for each department\'s own semester count instead of a hardcoded 8', () => {
  const seed = fs.readFileSync(new URL('../../server/src/utils/seed.js', import.meta.url), 'utf8');
  assert.match(seed, /function effectiveSemesterCount\(dept\)/);
  assert.match(seed, /dept\.semesterCount \|\| \(dept\.programLevel === 'diploma' \? 6 : 8\)/);

  // The department- and class-generation loops must consult that helper
  // rather than a bare literal - a hardcoded `<= 8` here would silently
  // seed 8 semesters for a department declared with a smaller
  // semesterCount, contradicting what classController.js/ClassesPage.jsx
  // already correctly enforce for real, non-seed departments.
  const ensureDepartmentsBody = seed.slice(seed.indexOf('async function ensureDepartments'), seed.indexOf('async function ensureSemesters'));
  assert.match(ensureDepartmentsBody, /semesterCount: effectiveSemesterCount\(definition\)/);
  assert.doesNotMatch(ensureDepartmentsBody, /semesterCount: 8/);

  const ensureClassesBody = seed.slice(seed.indexOf('async function ensureClasses'), seed.indexOf('async function ensureStudents'));
  assert.match(ensureClassesBody, /const semesterCount = effectiveSemesterCount\(dept\)/);
  assert.match(ensureClassesBody, /semNumber <= semesterCount/);
  assert.doesNotMatch(ensureClassesBody, /semNumber <= 8/);

  // The global semester pool must be sized to the longest configured
  // program rather than a bare 8, so a future department definition with
  // a larger semesterCount doesn't seed classes pointing at semester
  // documents that were never created.
  const ensureSemestersBody = seed.slice(seed.indexOf('async function ensureSemesters'), seed.indexOf('async function ensureClasses'));
  assert.match(ensureSemestersBody, /Math\.max\(max, effectiveSemesterCount\(dept\)\)/);
});

test('demo seed refuses production mode before connecting to MongoDB', () => {
  const result = spawnSync(process.execPath, ['src/utils/seed.js'], {
    cwd: new URL('../../server/', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1:27017/unused' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /Refusing to run seed while NODE_ENV=production/);
});


test('canonical role migration refuses to run without explicit confirmation', () => {
  const result = spawnSync(process.execPath, ['src/utils/migrateCanonicalRoles.js'], {
    cwd: new URL('../../server/', import.meta.url),
    env: { ...process.env, NODE_ENV: 'test', MONGO_URI: 'mongodb://127.0.0.1:27017/unused', ALLOW_ROLE_MODEL_MIGRATION: 'false' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /Refusing role migration/);
});

test('HOD institution management routes are not inherited by Faculty', () => {
  const departmentController = fs.readFileSync(new URL('../../server/src/controllers/departmentController.js', import.meta.url), 'utf8');
  const semesterRoutes = fs.readFileSync(new URL('../../server/src/routes/semesterRoutes.js', import.meta.url), 'utf8');
  const classRoutes = fs.readFileSync(new URL('../../server/src/routes/classRoutes.js', import.meta.url), 'utf8');
  const departmentRoutes = fs.readFileSync(new URL('../../server/src/routes/departmentRoutes.js', import.meta.url), 'utf8');
  assert.doesNotMatch(departmentController, /req\.user\.department/);
  assert.match(semesterRoutes, /authorize\(ROLES\.SUPER_ADMIN\)/);
  assert.match(classRoutes, /router\.use\(authorize\(ROLES\.SUPER_ADMIN\)\)/);
  assert.match(departmentRoutes, /router\.use\(authorize\(ROLES\.SUPER_ADMIN\)\)/);
});


test('universal academic structure and registration contracts remain explicit', () => {
  const departmentModel = fs.readFileSync(new URL('../../server/src/models/Department.js', import.meta.url), 'utf8');
  const departmentController = fs.readFileSync(new URL('../../server/src/controllers/departmentController.js', import.meta.url), 'utf8');
  const departmentRoutes = fs.readFileSync(new URL('../../server/src/routes/departmentRoutes.js', import.meta.url), 'utf8');
  const semesterController = fs.readFileSync(new URL('../../server/src/controllers/semesterController.js', import.meta.url), 'utf8');
  const classController = fs.readFileSync(new URL('../../server/src/controllers/classController.js', import.meta.url), 'utf8');
  const registrationController = fs.readFileSync(new URL('../../server/src/controllers/registrationRequestController.js', import.meta.url), 'utf8');
  const authController = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');
  assert.match(departmentModel, /semesterCount/);
  assert.match(departmentModel, /max: 20/);
  assert.match(departmentController, /highestUsedSemester/);
  assert.match(departmentRoutes, /authorize\(ROLES\.SUPER_ADMIN\)/);
  assert.doesNotMatch(semesterController, /HOD accounts can create semesters only for their own department/);
  assert.match(classController, /Subject, User/);
  assert.match(registrationController, /bcrypt\.hash/);
  assert.match(registrationController, /rejectionReason/);
  assert.match(authController, /user\.department = departmentDoc\._id/);
});


test('administrator reset creates a permanent credential with one-time authorized display', () => {
  const controller = fs.readFileSync(new URL('../../server/src/controllers/userController.js', import.meta.url), 'utf8');
  const userSource = fs.readFileSync(new URL('../../server/src/models/User.js', import.meta.url), 'utf8');
  assert.match(controller, /randomInt/);
  assert.match(controller, /generatePermanentCredential/);
  assert.match(controller, /const permanentPassword = req\.body\.newPassword \|\| generatePermanentCredential\(\)/);
  assert.match(controller, /user\.password = permanentPassword/);
  assert.match(controller, /passwordResetRequired = false/);
  assert.match(controller, /passwordIsPermanent: true/);
  assert.match(controller, /resetCredential: permanentPassword/);
  assert.match(userSource, /bcrypt\.hash\(this\.password/);
  assert.doesNotMatch(controller, /permanentPassword.*console\.(log|error)/s);
});


test('HOD dashboard is institution-wide and uses canonical role-compatible totals', () => {
  const source = fs.readFileSync(new URL('../../server/src/controllers/dashboardController.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /hodDepartmentId/);
  assert.match(source, /roleValues\(ROLES\.USER\)/);
  assert.match(source, /roleValues\(ROLES\.ADMIN\)/);
  assert.match(source, /activityActorScope/);
});


test('v14 status references and Redis readiness contracts remain explicit', () => {
  const registrationModel = fs.readFileSync(new URL('../../server/src/models/RegistrationRequest.js', import.meta.url), 'utf8');
  const registrationController = fs.readFileSync(new URL('../../server/src/controllers/registrationRequestController.js', import.meta.url), 'utf8');
  const registrationRoutes = fs.readFileSync(new URL('../../server/src/routes/registrationRequestRoutes.js', import.meta.url), 'utf8');
  const redisService = fs.readFileSync(new URL('../../server/src/services/redisService.js', import.meta.url), 'utf8');
  const routeIndex = fs.readFileSync(new URL('../../server/src/routes/index.js', import.meta.url), 'utf8');
  assert.match(registrationModel, /statusCodeHash: \{ type: String, default: undefined, select: false \}/);
  assert.match(registrationModel, /statusCodeHash: 1/);
  assert.match(registrationController, /generateStatusCode/);
  assert.match(registrationController, /statusCodeHash: hashStatusToken\(statusCode\)/);
  assert.match(registrationRoutes, /AR-\[A-Z0-9\]\{4\}-\[A-Z0-9\]\{6\}/i);
  assert.match(redisService, /REDIS_CONNECT_TIMEOUT_MS/);
  assert.match(redisService, /REDIS_URL is required in production/);
  assert.match(routeIndex, /const redisRequired = process\.env\.NODE_ENV === 'production'/);
});


test('class timetables enforce scoped reads, HOD-only writes, and overlap-safe Faculty availability', () => {
  const controller = fs.readFileSync(new URL('../../server/src/controllers/timetableController.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../../server/src/routes/timetableRoutes.js', import.meta.url), 'utf8');
  const model = fs.readFileSync(new URL('../../server/src/models/Timetable.js', import.meta.url), 'utf8');
  assert.match(controller, /assertClassAccess/);
  assert.match(controller, /Only an authorized HOD can change class timetables/);
  assert.match(controller, /overlapping assignment in another class/);
  assert.match(controller, /getAvailableFaculty/);
  assert.match(routes, /authorize\(ROLES\.SUPER_ADMIN\)/);
  assert.match(model, /unique_timetable_per_class/);
  assert.match(model, /Break periods cannot have a subject or faculty assignment/);
});

test('direct message edits and deletes remain conversation-member and sender scoped', () => {
  const controller = fs.readFileSync(new URL('../../server/src/controllers/messageController.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../../server/src/routes/messageRoutes.js', import.meta.url), 'utf8');
  const validators = fs.readFileSync(new URL('../../server/src/validators/messageValidators.js', import.meta.url), 'utf8');
  const model = fs.readFileSync(new URL('../../server/src/models/Message.js', import.meta.url), 'utf8');
  assert.match(controller, /loadConversationForMember\(req\.params\.conversationId, actorId\)/);
  assert.match(controller, /sender: actorId/);
  assert.match(controller, /export const editConversationMessage/);
  assert.match(controller, /export const deleteConversationMessage/);
  assert.match(controller, /mode === 'me'/);
  assert.match(controller, /mode !== 'everyone'/);
  assert.match(controller, /hiddenFor: \{ \$ne: actorId \}/);
  assert.match(controller, /Message\.deleteOne/);
  assert.match(controller, /refreshConversationPreview/);
  assert.match(controller, /Notification\.deleteMany/);
  assert.match(routes, /messages\/:messageId/);
  assert.match(routes, /rejectUnknownBodyFields\(\['mode'\]\)/);
  assert.match(routes, /editMessageValidator/);
  assert.match(routes, /deleteMessageValidator/);
  assert.match(validators, /body\('body'\).*max: 5000/);
  assert.match(validators, /body\('mode'\).*isIn\(\['me', 'everyone'\]\)/);
  assert.match(validators, /param\('messageId'\).*isMongoId/);
  assert.match(model, /hiddenFor/);
  assert.match(model, /editedAt/);
});

test('tutor scope and leave decisions remain server-enforced and rejection reasons are mandatory', () => {
  const authorization = fs.readFileSync(new URL('../../server/src/utils/authorization.js', import.meta.url), 'utf8');
  const classController = fs.readFileSync(new URL('../../server/src/controllers/classController.js', import.meta.url), 'utf8');
  const leaveController = fs.readFileSync(new URL('../../server/src/controllers/leaveController.js', import.meta.url), 'utf8');
  const leaveModel = fs.readFileSync(new URL('../../server/src/models/LeaveRequest.js', import.meta.url), 'utf8');
  const leaveRoutes = fs.readFileSync(new URL('../../server/src/routes/leaveRoutes.js', import.meta.url), 'utf8');
  assert.match(authorization, /classTeacher: req\.user\._id/);
  assert.match(classController, /active Faculty account/);
  assert.match(leaveController, /Only the current tutor can decide/);
  assert.match(leaveController, /Only the assigned tutor or HOD/);
  assert.match(leaveController, /decisionReason/);
  assert.match(leaveModel, /A rejection reason is required/);
  assert.match(leaveRoutes, /decideLeaveRequestValidator/);
});

test('canonical post-login routes and navigation blank-state safeguards remain explicit', () => {
  const login = fs.readFileSync(new URL('../../client/src/pages/auth/LoginPage.jsx', import.meta.url), 'utf8');
  const layout = fs.readFileSync(new URL('../../client/src/components/layout/DashboardLayout.jsx', import.meta.url), 'utf8');
  const navigation = fs.readFileSync(new URL('../../client/src/components/layout/navigation.js', import.meta.url), 'utf8');
  assert.match(login, /getHomePath/);
  assert.match(navigation, /super_admin: 'Head of Department'/);
  assert.match(navigation, /to: '\/faculty'/);
  assert.match(navigation, /to: '\/student'/);
  assert.doesNotMatch(layout, /AnimatePresence mode="wait"/);
  assert.match(layout, /key=\{location\.pathname\}/);
});

test('Faculty inability requests are exact-slot scoped, rate-limited, and HOD replacement decisions are atomic', () => {
  const model = fs.readFileSync(new URL('../../server/src/models/AssignmentRequest.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../../server/src/controllers/assignmentRequestController.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../../server/src/routes/assignmentRequestRoutes.js', import.meta.url), 'utf8');
  const validators = fs.readFileSync(new URL('../../server/src/validators/assignmentRequestValidators.js', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../../server/src/services/timetableService.js', import.meta.url), 'utf8');
  const limiter = fs.readFileSync(new URL('../../server/src/middleware/rateLimiters.js', import.meta.url), 'utf8');
  const clientApi = fs.readFileSync(new URL('../../client/src/api/workflows.js', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../client/src/pages/shared/AssignmentRequestsPage.jsx', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../../client/src/App.jsx', import.meta.url), 'utf8');
  assert.match(model, /one_pending_assignment_request_per_slot/);
  assert.match(model, /immutable: true/);
  assert.match(model, /Accepted assignment requests require a replacement Faculty member/);
  assert.match(controller, /Only the Faculty currently assigned to a timetable slot/);
  assert.match(controller, /A pending inability request already exists/);
  assert.match(controller, /findFacultyAssignmentConflicts/);
  assert.match(controller, /withTransaction/);
  assert.match(controller, /days\.\$\[day\]\.slots\.\$\[slot\]\.faculty/);
  assert.match(routes, /assignmentRequestLimiter/);
  assert.match(routes, /decideAssignmentRequestValidator/);
  assert.match(validators, /reason.*min: 5, max: 1000/);
  assert.match(service, /findFacultyAssignmentConflicts/);
  assert.match(limiter, /RATE_LIMIT_ASSIGNMENT_REQUEST_MAX/);
  assert.match(clientApi, /assignmentRequestApi/);
  assert.match(page, /Report inability/);
  assert.match(page, /Accept and replace/);
  assert.match(app, /assignment-requests/);
});

test('Faculty period directory is scoped to exact assigned class-timetable slots', () => {
  const periodController = fs.readFileSync(new URL('../../server/src/controllers/periodTemplateController.js', import.meta.url), 'utf8');
  const timetableService = fs.readFileSync(new URL('../../server/src/services/timetableService.js', import.meta.url), 'utf8');
  const subjectController = fs.readFileSync(new URL('../../server/src/controllers/subjectController.js', import.meta.url), 'utf8');
  const attendanceController = fs.readFileSync(new URL('../../server/src/controllers/attendanceController.js', import.meta.url), 'utf8');
  const periodValidators = fs.readFileSync(new URL('../../server/src/validators/periodTemplateValidators.js', import.meta.url), 'utf8');
  const periodRoutes = fs.readFileSync(new URL('../../server/src/routes/periodTemplateRoutes.js', import.meta.url), 'utf8');
  assert.match(periodController, /canonicalRole\(req\.user\.role\) === ROLES\.ADMIN/);
  assert.match(periodController, /source === 'class-timetable'/);
  assert.match(periodController, /slot\.kind === PERIOD_KIND\.CLASS/);
  assert.match(periodController, /isSameId\(slot\.faculty, req\.user\._id\)/);
  assert.match(periodController, /const \{ classId, subjectId \} = req\.query/);
  assert.match(periodController, /Selected subject does not belong to this active class/);
  assert.match(periodController, /faculty-assigned-slots/);
  assert.match(timetableService, /getClassPeriodSlot/);
  assert.match(timetableService, /export async function getFacultySubjectScope/);
  assert.match(timetableService, /import mongoose from 'mongoose'/);
  assert.match(timetableService, /getFacultySubjectScope/);
  assert.match(periodValidators, /periodTemplateQueryValidator/);
  assert.match(periodValidators, /query\('classId'\)\.optional\(\)\.isMongoId/);
  assert.match(periodValidators, /query\('subjectId'\)\.optional\(\)\.isMongoId/);
  assert.match(periodRoutes, /periodTemplateQueryValidator, validate/);
  assert.match(attendanceController, /period\.kind === PERIOD_KIND\.CLASS/);
  assert.match(attendanceController, /isSameId\(period\.subject, subject\._id\)/);
  assert.match(attendanceController, /isSameId\(period\.faculty, req\.user\._id\)/);
});

test('attendance and QR Faculty actions require the exact class-timetable slot', () => {
  const attendance = fs.readFileSync(new URL('../../server/src/controllers/attendanceController.js', import.meta.url), 'utf8');
  const qr = fs.readFileSync(new URL('../../server/src/controllers/qrController.js', import.meta.url), 'utf8');
  assert.match(attendance, /You are not assigned to this exact timetable period/);
  assert.match(attendance, /resolveSessionContext\(\{/);
  assert.match(attendance, /getUTCDay\(\)/);
  assert.match(qr, /You are not assigned to this exact timetable period/);
  assert.match(qr, /getClassPeriodSlot/);
});


test('timetable occupancy and directory search contracts are bounded and actionable', () => {
  const timetableController = fs.readFileSync(new URL('../../server/src/controllers/timetableController.js', import.meta.url), 'utf8');
  const userController = fs.readFileSync(new URL('../../server/src/controllers/userController.js', import.meta.url), 'utf8');
  const userValidator = fs.readFileSync(new URL('../../server/src/validators/userValidators.js', import.meta.url), 'utf8');
  const userModel = fs.readFileSync(new URL('../../server/src/models/User.js', import.meta.url), 'utf8');
  const apiError = fs.readFileSync(new URL('../../server/src/utils/ApiError.js', import.meta.url), 'utf8');
  const errorHandler = fs.readFileSync(new URL('../../server/src/middleware/errorHandler.js', import.meta.url), 'utf8');
  assert.match(timetableController, /already occupied on/);
  assert.match(timetableController, /facultyName/);
  assert.match(timetableController, /slotId/);
  assert.match(timetableController, /candidate\.faculty/);
  assert.match(timetableController, /isSameId\(candidate\.faculty, facultyId\)/);
  assert.doesNotMatch(timetableController, /assignedFacultyId = slot\.faculty/);
  assert.match(timetableController, /subjectId/);
  assert.match(timetableController, /department: classDoc\.department/);
  assert.match(timetableController, /eligibleFacultyCount/);
  assert.match(timetableController, /busyFacultyCount/);
  assert.match(timetableController, /availableFacultyCount/);
  assert.match(timetableController, /availableFaculty/);
  assert.match(timetableController, /currentTimetableId/);
  assert.match(timetableController, /conflictingTimetableId/);
  assert.match(timetableController, /conflictingClassId/);
  assert.match(timetableController, /conflictingStartTime/);
  assert.match(timetableController, /DEBUG_TIMETABLE_CONFLICTS/);
  assert.match(timetableController, /timetable assignments conflict with existing Faculty schedules/);
  assert.match(timetableController, /existingFilter\.\_id = \{ \$ne: activeTimetableId \}/);
  assert.match(timetableController, /class: currentClassId \? \{ \$ne: currentClassId \}/);
  assert.match(timetableController, /internalConflictCount/);
  assert.match(timetableController, /externalConflictCount/);
  assert.match(timetableController, /TIMETABLE_CONFLICT_QUERY/);
  assert.match(timetableController, /The selected timetable changed\. Reload this class/);
  assert.match(timetableController, /resolvedTimetableId/);
  assert.match(timetableController, /otherTimetables = timetables\.filter/);
  assert.match(timetableController, /TIMETABLE_SAVE_IDENTITY/);
  assert.match(userController, /const searchPattern = `\^\$\{escapedSearch\}`;/);
  assert.match(userValidator, /query\('search'\)\.optional\(\)\.trim\(\)\.isLength\(\{ max: 80 \}\)/);
  assert.match(userValidator, /query\('department'\)\.optional\(\)\.isMongoId\(\)/);
  assert.match(userController, /\.\.\.\(department \? \{ department \} : \{\}\)/);
  assert.match(userModel, /role: 1, name: 1, createdAt: -1/);
  assert.match(apiError, /static conflict\(message = 'Conflict with existing resource', details = null\)/);
  assert.match(errorHandler, /Array\.isArray\(details\)/);
});

test('timetable PUT separates internal and external conflicts without weakening validation', () => {
  const timetableController = fs.readFileSync(new URL('../../server/src/controllers/timetableController.js', import.meta.url), 'utf8');
  assert.match(timetableController, /internalConflicts/);
  assert.match(timetableController, /externalConflicts/);
  assert.match(timetableController, /firstInternalConflict/);
  assert.match(timetableController, /firstExternalConflict/);
  assert.match(timetableController, /conflictTimetableMatchesActive/);
  assert.match(timetableController, /activeTimetableId = existing\?\._id \|\| null/);
  assert.match(timetableController, /submittedAssignments/);
  assert.match(timetableController, /TIMETABLE_CONFLICT_SUMMARY/);
  assert.match(timetableController, /conflictError\.code = 'TIMETABLE_CONFLICT'/);
});

test('timetable validator and shared overlap utility are release-gated', () => {
  const utility = fs.readFileSync(new URL('../../server/src/utils/timetableConflictUtils.js', import.meta.url), 'utf8');
  const validator = fs.readFileSync(new URL('../../server/src/utils/validateTimetables.js', import.meta.url), 'utf8');
  const packageJson = fs.readFileSync(new URL('../../server/package.json', import.meta.url), 'utf8');
  const seed = fs.readFileSync(new URL('../../server/src/utils/seed.js', import.meta.url), 'utf8');
  const governmentSeed = fs.readFileSync(new URL('../../server/src/utils/seed_government_polytechnic.js', import.meta.url), 'utf8');
  assert.match(utility, /export function slotTimeOverlaps/);
  assert.match(utility, /export function detectFacultyOverlaps/);
  assert.match(utility, /export function summarizeFacultyConflicts/);
  assert.match(validator, /Total Faculty assignments/);
  assert.match(validator, /Actual overlapping assignments/);
  assert.match(validator, /process\.exitCode = 1/);
  assert.match(packageJson, /validate:timetables/);
  assert.match(seed, /Generated timetable validation failed/);
  assert.match(seed, /Persisted timetable validation failed/);
  assert.match(seed, /Conflict validation:/);
  assert.match(seed, /const facultyBySubject = new Map/);
  assert.match(governmentSeed, /const departmentFaculty = facultyByDepartment\[department\.code\]/);
});

test('v20 timetable identifier diagnostics preserve class-route versus timetable-document distinction', () => {
  const diagnostic = fs.readFileSync(new URL('../../server/src/utils/diagnoseTimetableIds.js', import.meta.url), 'utf8');
  const packageJson = fs.readFileSync(new URL('../../server/package.json', import.meta.url), 'utf8');
  assert.match(diagnostic, /DIAGNOSTIC_TIMETABLE_IDS/);
  assert.match(diagnostic, /asTimetable/);
  assert.match(diagnostic, /asClass/);
  assert.match(diagnostic, /activeTimetableForClass/);
  assert.match(diagnostic, /class identifier used by GET.*timetables.*classId/);
  assert.match(packageJson, /diagnose:timetable-ids/);
});

test('product-facing sources omit legacy release labels', () => {
  const authLayout = fs.readFileSync(new URL('../../client/src/components/layout/AuthLayout.jsx', import.meta.url), 'utf8');
  const apiRoot = fs.readFileSync(new URL('../../server/src/app.js', import.meta.url), 'utf8');
  const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const openapi = fs.readFileSync(new URL('../../docs/openapi.yaml', import.meta.url), 'utf8');
  assert.doesNotMatch(authLayout, /\bv(?:16|17)(?:\.\d+)*\b/i);
  assert.doesNotMatch(apiRoot, /Attendance Register API v\d/i);
  assert.doesNotMatch(readme, /Attendance Register v\d/i);
  assert.doesNotMatch(openapi, /Attendance Register v\d/i);
});

test('seed contract preserves account safety and timetable integrity', () => {
  const seed = fs.readFileSync(new URL('../../server/src/utils/seed.js', import.meta.url), 'utf8');
  assert.doesNotMatch(seed, /SMART FULL SEED[^\n]*V\d/i);
  assert.match(seed, /reserveExistingIdentityValues/);
  assert.match(seed, /usedRegisterNumbers/);
  assert.match(seed, /usedEmployeeIds/);
  assert.match(seed, /candidate > todayUtc/);
  assert.match(seed, /Refusing to use it as the administrator/);
  assert.match(seed, /Refusing to overwrite it/);
  assert.match(seed, /filter\(\(item\) => item\.isActive !== false\)/);
  assert.match(seed, /role: 'super_admin'/);
  assert.match(seed, /role: 'admin'/);
  assert.match(seed, /role: 'user'/);
  assert.match(seed, /FACULTY_TARGET_PER_DEPARTMENT = 20/);
  assert.match(seed, /const facultyLoad = new Map/);
  assert.match(seed, /current weekly assignment load/);
  assert.match(seed, /facultyLoad\.set/);
});

test('timetable seed and audits require real persisted slot ObjectIds without weakening conflicts', () => {
  const seedSource = fs.readFileSync(new URL('../../server/src/utils/seed.js', import.meta.url), 'utf8');
  const auditSource = fs.readFileSync(new URL('../../server/src/utils/validateTimetables.js', import.meta.url), 'utf8');
  const diagnosisSource = fs.readFileSync(new URL('../../server/src/utils/diagnoseTimetableIds.js', import.meta.url), 'utf8');
  const conflictSource = fs.readFileSync(new URL('../../server/src/utils/timetableConflictUtils.js', import.meta.url), 'utf8');
  assert.match(seedSource, /stableTimetableSlotId\(meta\.classId, day, period\.order\)/);
  assert.match(seedSource, /validateTimetableDocuments\(persisted\)/);
  assert.match(seedSource, /persistedValidation\.slotIdIntegrity\.ok/);
  assert.match(auditSource, /Missing slot IDs:/);
  assert.match(auditSource, /slotIdIntegrity\.ok/);
  assert.match(diagnosisSource, /persistedSlotIds/);
  assert.match(conflictSource, /inspectTimetableSlotIds/);
  assert.match(conflictSource, /duplicateSlotIds/);
  assert.match(conflictSource, /detectFacultyOverlaps/);
});

test('subject list remains server-paginated while Academic Management requests bounded pages', () => {
  const controllerSource = fs.readFileSync(new URL('../../server/src/controllers/subjectController.js', import.meta.url), 'utf8');
  const routeSource = fs.readFileSync(new URL('../../server/src/routes/subjectRoutes.js', import.meta.url), 'utf8');
  assert.match(controllerSource, /defaultLimit: 50, maxLimit: 100/);
  assert.match(controllerSource, /paginationMeta/);
  assert.match(routeSource, /router\.get\('\/', controller\.getSubjects\)/);
});


test('v26 messaging authorization is relationship-scoped and server enforced', () => {
  const authorization = fs.readFileSync(new URL('../../server/src/utils/messagingAuthorization.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../../server/src/controllers/messageController.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../../server/src/routes/messageRoutes.js', import.meta.url), 'utf8');
  assert.match(authorization, /getAllowedMessagingRecipientIds/);
  assert.match(authorization, /isActive: true/);
  assert.match(authorization, /Subject\.find/);
  assert.match(authorization, /Timetable\.find/);
  assert.match(authorization, /classTeacher/);
  assert.match(authorization, /roleValues\(ROLES\.SUPER_ADMIN\)/);
  assert.match(controller, /assertMessagingRecipient\(req\.user, recipient\.\_id\)/);
  assert.match(controller, /loadConversationForMember/);
  assert.match(controller, /participants: actorId/);
  assert.doesNotMatch(controller, /req\.body\.participants/);
  assert.doesNotMatch(controller, /req\.body\.recipientUrl/);
  assert.match(routes, /router\.use\(protect\)/);
  assert.match(routes, /router\.param\('conversationId', validateObjectIdParam\)/);
  assert.match(routes, /\/recipients/);
  assert.match(routes, /\/conversations/);
  assert.match(routes, /\/read/);
});

test('v26 messaging stores bounded text only and rejects media-shaped inputs', () => {
  const model = fs.readFileSync(new URL('../../server/src/models/Message.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../../server/src/controllers/messageController.js', import.meta.url), 'utf8');
  const validators = fs.readFileSync(new URL('../../server/src/validators/messageValidators.js', import.meta.url), 'utf8');
  const uploadRoutes = fs.readFileSync(new URL('../../server/src/routes/uploadRoutes.js', import.meta.url), 'utf8');
  assert.match(model, /body: \{ type: String, trim: true, required: true, maxlength: 5000 \}/);
  assert.match(model, /A message must contain text/);
  assert.doesNotMatch(model, /attachments|MessageAttachment|media|file/);
  assert.match(controller, /Message\.create/);
  assert.match(controller, /body/);
  assert.doesNotMatch(controller, /attachment|multipart|upload|MessageAttachment/);
  assert.match(validators, /isLength\(\{ min: 1, max: 5000 \}\)/);
  assert.doesNotMatch(validators, /attachmentIds|multipart/);
  assert.doesNotMatch(uploadRoutes, /message-attachment|attachmentUpload/);
});

test('v26 messaging sends generic notifications, content-safe audit records, and uses a user limiter', () => {
  const constants = fs.readFileSync(new URL('../../server/src/config/constants.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../../server/src/controllers/messageController.js', import.meta.url), 'utf8');
  const limiter = fs.readFileSync(new URL('../../server/src/middleware/rateLimiters.js', import.meta.url), 'utf8');
  assert.match(constants, /MESSAGE: 'message'/);
  assert.match(constants, /MESSAGE_SENT: 'message_sent'/);
  assert.match(controller, /type: NOTIFICATION_TYPE\.MESSAGE/);
  assert.match(controller, /message: 'You have a new message in Attendance Register\.'/);
  assert.match(controller, /meta: \{ conversationId: conversation\.\_id, messageId: message\.\_id \}/);
  assert.match(controller, /action: ACTIVITY_ACTION\.MESSAGE_SENT/);
  assert.match(controller, /recipientId/);
  assert.doesNotMatch(controller, /newValue: \{[^}]*body/);
  assert.match(limiter, /messageSendLimiter/);
  assert.match(limiter, /keyType: 'user'/);
});


test('v26 Message and Conversation schemas enforce text-only direct threads', async () => {
  const first = '507f1f77bcf86cd799439011';
  const second = '507f1f77bcf86cd799439012';
  const conversation = new Conversation({
    participants: [first, second],
    participantKey: [first, second].sort().join(':'),
  });
  await conversation.validate();
  const message = new Message({ conversation: conversation._id, sender: first, recipient: second, body: 'Stored securely in MongoDB.' });
  await message.validate();
  assert.equal(message.body, 'Stored securely in MongoDB.');
  const empty = new Message({ conversation: conversation._id, sender: first, recipient: second, body: '   ' });
  await assert.rejects(empty.validate(), /A message must contain text/);
});


test('v26 chat profiles expose authorized safe academic details only', () => {
  const controller = fs.readFileSync(new URL('../../server/src/controllers/messageController.js', import.meta.url), 'utf8');
  const validators = fs.readFileSync(new URL('../../server/src/validators/messageValidators.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../../server/src/routes/messageRoutes.js', import.meta.url), 'utf8');
  assert.match(controller, /export const getMessageProfile/);
  assert.match(controller, /await assertMessagingRecipient\(req\.user, user\._id\)/);
  assert.match(controller, /assignedSubjects/);
  assert.match(controller, /tutorClasses/);
  assert.match(controller, /getOverallAttendance/);
  assert.doesNotMatch(controller, /select\([^)]*password/);
  assert.match(validators, /messageProfileValidator/);
  assert.match(routes, /profiles\/:userId/);
  assert.match(routes, /validateObjectIdParam/);
});

test('v26.1 grouped recipients resolve canonical roles, sync message notifications, and keep Student HOD selection singular', () => {
  const messaging = fs.readFileSync(new URL('../../server/src/controllers/messageController.js', import.meta.url), 'utf8');
  const authorization = fs.readFileSync(new URL('../../server/src/utils/messagingAuthorization.js', import.meta.url), 'utf8');
  assert.match(messaging, /canonicalRole, roleValues/);
  assert.match(messaging, /roleValues\(role\)/);
  assert.match(messaging, /Notification\.updateMany/);
  assert.match(messaging, /meta\.conversationId/);
  assert.match(authorization, /roleValues\(ROLES\.SUPER_ADMIN\)[\s\S]*?limit\(1\)/);
});

test('v26 recipient groups and HOD directory filters remain server-derived', () => {
  const messaging = fs.readFileSync(new URL('../../server/src/controllers/messageController.js', import.meta.url), 'utf8');
  const authorization = fs.readFileSync(new URL('../../server/src/utils/messagingAuthorization.js', import.meta.url), 'utf8');
  const users = fs.readFileSync(new URL('../../server/src/controllers/userController.js', import.meta.url), 'utf8');
  const validators = fs.readFileSync(new URL('../../server/src/validators/userValidators.js', import.meta.url), 'utf8');
  const messageValidators = fs.readFileSync(new URL('../../server/src/validators/messageValidators.js', import.meta.url), 'utf8');
  assert.match(messaging, /req\.query\.group/);
  assert.match(messaging, /groupIds/);
  assert.match(messaging, /group === 'tutors'/);
  assert.match(messageValidators, /query\('group'\)/);
  assert.match(messageValidators, /supported messaging category/);
  assert.match(messaging, /groups/);
  assert.match(messaging, /isTutor/);
  assert.match(authorization, /const tutors/);
  assert.match(authorization, /return uniqueIds\(\[\.\.\.students, \.\.\.hods, \.\.\.tutors, \.\.\.facultyPeers\]\)/);
  assert.match(users, /tutorsOnly/);
  assert.match(users, /allowedSorts/);
  assert.match(users, /sortDepartment/);
  assert.match(users, /sortSemester/);
  assert.match(users, /sortClass/);
  assert.match(validators, /query\('semester'\)/);
  assert.match(validators, /query\('tutorsOnly'\)/);
  assert.match(validators, /query\('sortBy'\)/);
  assert.match(validators, /query\('sortOrder'\)/);
});


test('critical mutation routes use explicit body contracts and reject unexpected fields', () => {
  const authRoutes = fs.readFileSync(new URL('../../server/src/routes/authRoutes.js', import.meta.url), 'utf8');
  const registrationRoutes = fs.readFileSync(new URL('../../server/src/routes/registrationRequestRoutes.js', import.meta.url), 'utf8');
  const userRoutes = fs.readFileSync(new URL('../../server/src/routes/userRoutes.js', import.meta.url), 'utf8');
  const messageRoutes = fs.readFileSync(new URL('../../server/src/routes/messageRoutes.js', import.meta.url), 'utf8');
  const strictBody = fs.readFileSync(new URL('../../server/src/middleware/strictBody.js', import.meta.url), 'utf8');
  assert.match(strictBody, /Unsupported request field/);
  assert.match(authRoutes, /rejectUnknownBodyFields\(\['identifier', 'password'\]\)/);
  assert.match(authRoutes, /rejectUnknownBodyFields\(\[\]\)/);
  assert.match(registrationRoutes, /rejectUnknownBodyFields\(\['requestedRole', 'name', 'email', 'password', 'phone', 'dateOfBirth', 'avatarUrl', 'classId', 'departmentId'\]\)/);
  assert.match(registrationRoutes, /rejectUnknownBodyFields\(\['identifier'\]\)/);
  assert.match(registrationRoutes, /rejectUnknownBodyFields\(\['reason'\]\)/);
  assert.match(userRoutes, /rejectUnknownBodyFields/);
  assert.match(messageRoutes, /rejectUnknownBodyFields\(\['body'\]\)/);
  assert.match(messageRoutes, /rejectUnknownBodyFields\(\[\]\)/);

  const guard = rejectUnknownBodyFields(['safe']);
  assert.doesNotThrow(() => guard({ body: { safe: 'value' } }, {}, () => {}));
  assert.throws(() => guard({ body: { safe: 'value', password: 'unexpected' } }, {}, () => {}), /Unsupported request field: password/);
});

test('cookie-authenticated endpoints reject cross-site Fetch Metadata and JWT algorithms are pinned', () => {
  let deniedError;
  cookieOriginGuard({ get: (header) => header === 'sec-fetch-site' ? 'cross-site' : undefined }, {}, (error) => { deniedError = error; });
  assert.equal(deniedError?.statusCode, 403);
  assert.equal(deniedError?.code, 'COOKIE_ORIGIN_DENIED');

  const jwtSource = fs.readFileSync(new URL('../../server/src/utils/jwt.js', import.meta.url), 'utf8');
  assert.match(jwtSource, /algorithm: 'HS256'/g);
  assert.match(jwtSource, /algorithms: \['HS256'\]/g);
});


test('production startup fails closed on weak secrets, insecure cookies, LAN origins, or missing shared Redis', () => {
  const valid = {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'A1!access-secret-with-enough-entropy-2026',
    JWT_REFRESH_SECRET: 'B2@refresh-secret-with-enough-entropy-2026',
    CLIENT_URL: 'https://attendance.example.edu',
    ALLOWED_ORIGINS: 'https://attendance.example.edu,https://admin.example.edu',
    REFRESH_COOKIE_SECURE: 'true',
    ALLOW_LAN_ORIGINS: 'false',
    DISABLE_RATE_LIMITS: 'false',
    REDIS_URL: 'redis://redis.internal:6379',
    TRUST_PROXY_HOPS: '1',
  };
  assert.doesNotThrow(() => assertSecurityConfiguration(valid));
  assert.throws(() => assertSecurityConfiguration({ ...valid, JWT_ACCESS_SECRET: 'replace-with-a-random-secret' }), /JWT_ACCESS_SECRET/);
  assert.throws(() => assertSecurityConfiguration({ ...valid, REFRESH_COOKIE_SECURE: 'false' }), /REFRESH_COOKIE_SECURE/);
  assert.throws(() => assertSecurityConfiguration({ ...valid, REDIS_URL: '' }), /REDIS_URL/);
  assert.throws(() => assertSecurityConfiguration({ ...valid, CLIENT_URL: 'http://attendance.example.edu' }), /exact HTTPS/);
});


test('legacy Faculty aliases cannot bypass canonical role migration guards', () => {
  const authController = fs.readFileSync(new URL('../../server/src/controllers/authController.js', import.meta.url), 'utf8');
  const authMiddleware = fs.readFileSync(new URL('../../server/src/middleware/auth.js', import.meta.url), 'utf8');
  assert.match(authController, /canonicalRole\(user\.role\) === ROLES\.ADMIN && user\.roleModelVersion !== 2/);
  assert.match(authMiddleware, /canonicalRole\(user\.role\) === ROLES\.ADMIN && user\.roleModelVersion !== 2/);
});


test('state-changing JSON domains use strict body guards while profile uploads remain multipart-only', () => {
  const routeFiles = [
    'authRoutes.js',
    'registrationRequestRoutes.js',
    'messageRoutes.js',
    'userRoutes.js',
    'departmentRoutes.js',
    'semesterRoutes.js',
    'classRoutes.js',
    'subjectRoutes.js',
    'periodTemplateRoutes.js',
    'timetableRoutes.js',
    'attendanceRoutes.js',
    'qrRoutes.js',
    'leaveRoutes.js',
    'assignmentRequestRoutes.js',
    'notificationRoutes.js',
  ];
  routeFiles.forEach((file) => {
    const source = fs.readFileSync(new URL(`../../server/src/routes/${file}`, import.meta.url), 'utf8');
    assert.match(source, /rejectUnknownBodyFields/);
  });
  const uploadRoutes = fs.readFileSync(new URL('../../server/src/routes/uploadRoutes.js', import.meta.url), 'utf8');
  assert.match(uploadRoutes, /upload\.single\('photo'\)/);
  assert.doesNotMatch(uploadRoutes, /rejectUnknownBodyFields/);
});
