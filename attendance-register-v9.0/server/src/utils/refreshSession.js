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
