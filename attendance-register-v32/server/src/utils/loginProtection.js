const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_THRESHOLD = 5;
const DEFAULT_BASE_LOCK_MS = 60 * 1000;
const DEFAULT_MAX_LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 20;

function envNumber(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function getLoginProtectionConfig() {
  return {
    windowMs: envNumber('LOGIN_FAILURE_WINDOW_MS', DEFAULT_WINDOW_MS, { min: 10_000, max: 24 * 60 * 60 * 1000 }),
    threshold: envNumber('LOGIN_FAILURE_THRESHOLD', DEFAULT_THRESHOLD, { min: 2, max: 10 }),
    baseLockMs: envNumber('LOGIN_LOCK_BASE_MS', DEFAULT_BASE_LOCK_MS, { min: 10_000, max: 60 * 60 * 1000 }),
    maxLockMs: envNumber('LOGIN_LOCK_MAX_MS', DEFAULT_MAX_LOCK_MS, { min: 60_000, max: 24 * 60 * 60 * 1000 }),
  };
}

export function isLoginTemporarilyLocked(user, now = new Date()) {
  return Boolean(user.loginLockedUntil && new Date(user.loginLockedUntil).getTime() > now.getTime());
}

export function getLoginFailureUpdate(user, now = new Date()) {
  const config = getLoginProtectionConfig();
  const previousWindow = user.loginFailureWindowStartedAt ? new Date(user.loginFailureWindowStartedAt) : null;
  const withinWindow = previousWindow && now.getTime() - previousWindow.getTime() < config.windowMs;
  const failedLoginAttempts = Math.min(MAX_FAILURES, withinWindow ? Number(user.failedLoginAttempts || 0) + 1 : 1);
  const loginFailureWindowStartedAt = withinWindow ? previousWindow : now;
  const thresholdExceeded = failedLoginAttempts >= config.threshold;
  const lockMultiplier = Math.max(0, failedLoginAttempts - config.threshold);
  const lockDuration = Math.min(config.maxLockMs, config.baseLockMs * (2 ** lockMultiplier));

  return {
    failedLoginAttempts,
    loginFailureWindowStartedAt,
    loginLockedUntil: thresholdExceeded ? new Date(now.getTime() + lockDuration) : null,
  };
}

export function getLoginFailureReset() {
  return {
    failedLoginAttempts: 0,
    loginFailureWindowStartedAt: null,
    loginLockedUntil: null,
  };
}
