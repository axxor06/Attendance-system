const SECRET_MIN_LENGTH = 32;
const PLACEHOLDER_SECRET_PATTERN = /^(replace[-_ ]with|change[-_ ]me|secret|password|test)[-_ ]?/i;
const ADMIN_RESET_PASSWORD_TTL_DEFAULT_MS = 15 * 60 * 1000;
const ADMIN_RESET_PASSWORD_TTL_MIN_MS = 5 * 60 * 1000;
const ADMIN_RESET_PASSWORD_TTL_MAX_MS = 24 * 60 * 60 * 1000;

function isStrongSecret(value) {
  return typeof value === 'string'
    && value.length >= SECRET_MIN_LENGTH
    && !PLACEHOLDER_SECRET_PATTERN.test(value)
    && !/^(.+)\1+$/.test(value);
}

function parsePositiveNumber(value, { min, max } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (min !== undefined && parsed < min) return null;
  if (max !== undefined && parsed > max) return null;
  return parsed;
}

function parseOrigin(value) {
  try {
    const origin = new URL(value);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null;
    return origin;
  } catch {
    return null;
  }
}

function productionOriginList(env) {
  return [
    env.CLIENT_URL,
    ...(env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ];
}

/**
 * Fail closed before the server accepts traffic when its security-critical
 * production configuration is missing or obviously unsafe.
 */
export function assertSecurityConfiguration(env = process.env) {
  if (env.NODE_ENV === 'test') return;

  const problems = [];
  if (!isStrongSecret(env.JWT_ACCESS_SECRET)) problems.push(`JWT_ACCESS_SECRET must be a unique value of at least ${SECRET_MIN_LENGTH} characters`);
  if (!isStrongSecret(env.JWT_REFRESH_SECRET)) problems.push(`JWT_REFRESH_SECRET must be a unique value of at least ${SECRET_MIN_LENGTH} characters`);
  if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) problems.push('JWT access and refresh secrets must be different');

  const proxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0) problems.push('TRUST_PROXY_HOPS must be a non-negative integer');

  const timeoutRules = [
    ['HTTP_REQUEST_TIMEOUT_MS', 1000, 120000],
    ['HTTP_HEADERS_TIMEOUT_MS', 1000, 120000],
    ['HTTP_KEEP_ALIVE_TIMEOUT_MS', 1000, 120000],
    ['SHUTDOWN_TIMEOUT_MS', 1000, 120000],
  ];
  timeoutRules.forEach(([name, min, max]) => {
    if (env[name] !== undefined && parsePositiveNumber(env[name], { min, max }) === null) {
      problems.push(`${name} must be a number between ${min} and ${max} milliseconds`);
    }
  });

  if (env.ADMIN_RESET_PASSWORD_TTL_MS !== undefined
    && parsePositiveNumber(env.ADMIN_RESET_PASSWORD_TTL_MS, { min: ADMIN_RESET_PASSWORD_TTL_MIN_MS, max: ADMIN_RESET_PASSWORD_TTL_MAX_MS }) === null) {
    problems.push(`ADMIN_RESET_PASSWORD_TTL_MS must be a number between ${ADMIN_RESET_PASSWORD_TTL_MIN_MS} and ${ADMIN_RESET_PASSWORD_TTL_MAX_MS} milliseconds`);
  }

  const sameSite = String(env.REFRESH_COOKIE_SAMESITE || 'lax').toLowerCase();
  if (!['strict', 'lax', 'none'].includes(sameSite)) problems.push('REFRESH_COOKIE_SAMESITE must be strict, lax, or none');
  if (sameSite === 'none' && env.REFRESH_COOKIE_SECURE !== 'true') problems.push('REFRESH_COOKIE_SECURE=true is required when REFRESH_COOKIE_SAMESITE=none');

  if (env.NODE_ENV === 'production') {
    if (env.REFRESH_COOKIE_SECURE !== 'true') problems.push('REFRESH_COOKIE_SECURE=true is required in production');
    if (env.ALLOW_LAN_ORIGINS === 'true') problems.push('ALLOW_LAN_ORIGINS must be disabled in production');
    if (env.DISABLE_RATE_LIMITS === 'true') problems.push('DISABLE_RATE_LIMITS must be disabled in production');
    if (!env.REDIS_URL) problems.push('REDIS_URL is required in production for shared rate limits');

    const origins = productionOriginList(env);
    if (!origins.length) problems.push('CLIENT_URL or ALLOWED_ORIGINS must contain an exact HTTPS origin in production');
    origins.forEach((value) => {
      const origin = parseOrigin(value);
      if (!origin || origin.protocol !== 'https:') problems.push(`Production browser origin must be exact HTTPS: ${value || '(empty)'}`);
    });
  }

  if (problems.length) {
    throw new Error(`[Security] Unsafe configuration: ${problems.join('; ')}.`);
  }
}

export function getAdminResetPasswordTtlMs(env = process.env) {
  return parsePositiveNumber(env.ADMIN_RESET_PASSWORD_TTL_MS, {
    min: ADMIN_RESET_PASSWORD_TTL_MIN_MS,
    max: ADMIN_RESET_PASSWORD_TTL_MAX_MS,
  }) || ADMIN_RESET_PASSWORD_TTL_DEFAULT_MS;
}

export const SECURITY_SECRET_MIN_LENGTH = SECRET_MIN_LENGTH;
export const SECURITY_ADMIN_RESET_PASSWORD_TTL_DEFAULT_MS = ADMIN_RESET_PASSWORD_TTL_DEFAULT_MS;
export const SECURITY_ADMIN_RESET_PASSWORD_TTL_MIN_MS = ADMIN_RESET_PASSWORD_TTL_MIN_MS;
export const SECURITY_ADMIN_RESET_PASSWORD_TTL_MAX_MS = ADMIN_RESET_PASSWORD_TTL_MAX_MS;
