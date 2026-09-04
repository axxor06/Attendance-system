const SECRET_MIN_LENGTH = 32;
const PLACEHOLDER_SECRET_PATTERN = /^(replace[-_ ]with|change[-_ ]me|secret|password|test)[-_ ]?/i;

function isStrongSecret(value) {
  return typeof value === 'string'
    && value.length >= SECRET_MIN_LENGTH
    && !PLACEHOLDER_SECRET_PATTERN.test(value)
    && !/^(.+)\1+$/.test(value);
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

export const SECURITY_SECRET_MIN_LENGTH = SECRET_MIN_LENGTH;
