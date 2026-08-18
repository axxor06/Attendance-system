import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      tokenVersion: Number(user.tokenVersion || 0),
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

export function generateRefreshToken(user, { jti = crypto.randomUUID() } = {}) {
  return jwt.sign(
    { id: user._id.toString(), jti, tokenType: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  if (decoded?.tokenType !== 'refresh' || !decoded?.jti) {
    const error = new Error('Invalid refresh token');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return decoded;
}

/**
 * Parses a duration string like "7d" / "15m" / "12h" into milliseconds,
 * for setting matching cookie maxAge. Falls back to 7 days if unparseable.
 */
export function parseDurationToMs(durationStr, fallbackMs = 7 * 24 * 60 * 60 * 1000) {
  if (!durationStr) return fallbackMs;
  const match = /^(\d+)([smhd])$/.exec(durationStr.trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * unitMs[unit];
}
