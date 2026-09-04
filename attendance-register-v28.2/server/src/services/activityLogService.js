import { ActivityLog } from '../models/index.js';

/**
 * Records an audit entry. Callers must never pass passwords, OTPs, JWTs,
 * refresh tokens, or other secrets in oldValue/newValue/description.
 */
export async function logActivity({
  actorId,
  action,
  targetType,
  targetId,
  description,
  ipAddress,
  userAgent,
  reason,
  requestId,
  oldValue,
  newValue,
}) {
  try {
    await ActivityLog.create({
      actor: actorId,
      action,
      targetType,
      targetId,
      description,
      ipAddress,
      userAgent,
      reason,
      requestId,
      oldValue,
      newValue,
    });
  } catch (err) {
    console.error('[ActivityLog] Failed to record activity', {
      category: 'ACTIVITY_LOG_WRITE_FAILURE',
      errorName: err?.name || 'Error',
      errorCode: typeof err?.code === 'string' ? err.code.slice(0, 80) : undefined,
    });
  }
}
