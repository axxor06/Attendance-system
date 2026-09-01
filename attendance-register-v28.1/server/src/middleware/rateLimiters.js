import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisConfigured } from '../services/redisService.js';

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const sharedRateLimitEnabled = isRedisConfigured();

function numberEnv(name, fallback, { min = 1, max = 1_000_000 } = {}) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

const windowMinutes = numberEnv('RATE_LIMIT_WINDOW_MINUTES', 15, { min: 1, max: 24 * 60 });
const windowMs = windowMinutes * 60 * 1000;

function createRedisStore(name) {
  if (!sharedRateLimitEnabled) return undefined;

  return new RedisStore({
    prefix: `attendance-register:rate-limit:${name.toLowerCase()}:`,
    sendCommand: async (...args) => {
      const client = getRedisClient();
      if (!client?.isReady) throw new Error('Redis rate-limit store is not ready.');
      return client.sendCommand(args);
    },
  });
}

function normalizeIpKey(ip) {
  return String(ip || 'unknown').trim().toLowerCase().replace(/[^a-z0-9:.]/g, '_');
}

function createLimiter({ name, max, message, keyType = 'ip' }) {
  const store = createRedisStore(name);

  return rateLimit({
    windowMs,
    max: numberEnv(name, max, { min: 1, max: 1_000_000 }),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store,
    passOnStoreError: false,
    skip: () => isDevelopment && process.env.DISABLE_RATE_LIMITS === 'true',
    keyGenerator: (req) => {
      const ipKey = normalizeIpKey(req.ip);
      if (keyType === 'user' && req.user?._id) return `user:${String(req.user._id)}`;
      return `ip:${ipKey}`;
    },
    handler: (req, res) => res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message },
      requestId: req.id,
    }),
  });
}

export function isSharedRateLimitEnabled() {
  return sharedRateLimitEnabled;
}

export const generalLimiter = createLimiter({
  name: 'RATE_LIMIT_MAX_REQUESTS',
  max: 300,
  message: 'Too many requests. Please try again later.',
});

export const loginLimiter = createLimiter({
  name: 'RATE_LIMIT_LOGIN_MAX',
  max: 10,
  message: 'Too many login attempts. Please wait before trying again.',
});

export const otpGenerateLimiter = createLimiter({
  name: 'RATE_LIMIT_OTP_GENERATE_MAX',
  max: 5,
  message: 'Too many verification-code requests. Please wait before trying again.',
});

export const otpVerifyLimiter = createLimiter({
  name: 'RATE_LIMIT_OTP_VERIFY_MAX',
  max: 10,
  message: 'Too many verification-code attempts. Please wait before trying again.',
});

export const forgotPasswordLimiter = createLimiter({
  name: 'RATE_LIMIT_FORGOT_PASSWORD_MAX',
  max: 5,
  message: 'Too many password-reset requests. Please wait before trying again.',
});

export const passwordResetLimiter = createLimiter({
  name: 'RATE_LIMIT_PASSWORD_RESET_MAX',
  max: 10,
  message: 'Too many password-reset attempts. Please wait before trying again.',
});

export const passwordChangeLimiter = createLimiter({
  name: 'RATE_LIMIT_PASSWORD_CHANGE_MAX',
  max: 10,
  keyType: 'user',
  message: 'Too many password-change attempts. Please wait before trying again.',
});

export const qrGenerateLimiter = createLimiter({
  name: 'RATE_LIMIT_QR_GENERATE_MAX',
  max: 20,
  keyType: 'user',
  message: 'Too many attendance-session requests. Please wait before generating another QR.',
});

export const qrScanLimiter = createLimiter({
  name: 'RATE_LIMIT_QR_SCAN_MAX',
  max: 30,
  keyType: 'user',
  message: 'Too many QR scan attempts. Please wait before trying again.',
});

export const profilePhotoLimiter = createLimiter({
  name: 'RATE_LIMIT_PROFILE_PHOTO_MAX',
  max: 10,
  message: 'Too many photo upload attempts. Please wait and try again.',
});

export const attendanceSubmitLimiter = createLimiter({
  name: 'RATE_LIMIT_ATTENDANCE_SUBMIT_MAX',
  max: 120,
  keyType: 'user',
  message: 'Too many attendance submissions. Please wait before trying again.',
});

export const refreshLimiter = createLimiter({
  name: 'RATE_LIMIT_REFRESH_MAX',
  max: 30,
  message: 'Too many session-refresh requests. Please log in again if this persists.',
});

export const registrationRequestLimiter = createLimiter({
  name: 'RATE_LIMIT_REGISTRATION_REQUEST_MAX',
  max: 5,
  message: 'Too many registration requests. Please wait before trying again.',
});

export const registrationStatusLimiter = createLimiter({
  name: 'RATE_LIMIT_REGISTRATION_STATUS_MAX',
  max: 30,
  message: 'Too many status checks. Please wait before trying again.',
});

export const assignmentRequestLimiter = createLimiter({
  name: 'RATE_LIMIT_ASSIGNMENT_REQUEST_MAX',
  max: 8,
  keyType: 'user',
  message: 'Too many assignment-request actions. Please wait before trying again.',
});

export const messageSendLimiter = createLimiter({
  name: 'RATE_LIMIT_MESSAGE_SEND_MAX',
  max: 60,
  keyType: 'user',
  message: 'Too many messages sent. Please wait before trying again.',
});

export const authLimiter = loginLimiter;
