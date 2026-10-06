import crypto from 'crypto';

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

export function getRefreshExpiryDate(decoded) {
  return decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export function getRefreshRotationGraceMs() {
  const configured = Number(process.env.REFRESH_ROTATION_GRACE_MS);
  return Number.isFinite(configured) && configured >= 250 && configured <= 10000 ? configured : 1500;
}

export function isConcurrentRotationGraceEligible(session, tokenHash, now = new Date()) {
  if (!session?.revokedAt || !session.replacedByJti || !session.lastUsedAt) return false;
  if (session.tokenHash !== tokenHash) return false;
  if (session.expiresAt && new Date(session.expiresAt) <= now) return false;
  return now.getTime() - new Date(session.lastUsedAt).getTime() <= getRefreshRotationGraceMs();
}
