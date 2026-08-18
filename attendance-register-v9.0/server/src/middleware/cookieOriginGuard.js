function isAllowedDevelopmentLanOrigin(origin) {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_LAN_ORIGINS !== 'true') return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['5173', '3000'].includes(url.port)) return false;
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    const parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return parts[0] === 10
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168);
  } catch {
    return false;
  }
}

function configuredOrigins() {
  return new Set([
    process.env.CLIENT_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()),
    ...(process.env.NODE_ENV === 'production' ? [] : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ]),
  ].filter(Boolean));
}

/**
 * Refresh and logout authenticate with an HTTP-only cookie. CORS and SameSite
 * remain the primary browser controls; this middleware adds an explicit origin
 * check when a browser sends an Origin header, including SameSite=None setups.
 * Requests without Origin remain valid for non-browser/internal clients.
 */
export function cookieOriginGuard(req, _res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  if (configuredOrigins().has(origin) || isAllowedDevelopmentLanOrigin(origin)) return next();

  const error = new Error('Request origin is not allowed');
  error.statusCode = 403;
  error.code = 'COOKIE_ORIGIN_DENIED';
  return next(error);
}
