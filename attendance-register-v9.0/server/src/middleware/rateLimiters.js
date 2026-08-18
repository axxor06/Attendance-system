import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisConfigured } from '../services/redisService.js';

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000;
const sharedRateLimitEnabled = isRedisConfigured();

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const redisStore = sharedRateLimitEnabled
  ? new RedisStore({
    sendCommand: async (...args) => {
      const client = getRedisClient();
      if (!client?.isReady) throw new Error('Redis rate-limit store is not ready.');
      return client.sendCommand(args);
    },
  })
  : undefined;

function createLimiter({ name, max, message }) {
  return rateLimit({
    windowMs,
    max: numberEnv(name, max),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: redisStore,
    passOnStoreError: false,
    skip: () => isDevelopment && process.env.DISABLE_RATE_LIMITS === 'true',
    keyGenerator: (req) => req.ip,
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

export const authLimiter = loginLimiter;
