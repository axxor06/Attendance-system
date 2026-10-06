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
    console.error('[ActivityLog] Failed to record activity:', err.message);
  }
}
