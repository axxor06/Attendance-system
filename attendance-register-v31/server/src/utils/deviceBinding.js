import crypto from 'crypto';
import ApiError from './ApiError.js';
import { canonicalRole, roleValues, ROLES } from '../config/constants.js';

export const DEVICE_ID_HEADER = 'x-device-id';
const MIN_DEVICE_ID_LENGTH = 20;
const MAX_DEVICE_ID_LENGTH = 200;

export function normalizeDeviceId(value) {
  const normalized = String(value || '').trim();
  if (normalized.length < MIN_DEVICE_ID_LENGTH || normalized.length > MAX_DEVICE_ID_LENGTH) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) return null;
  return normalized;
}

export function getRequestDeviceId(req) {
  return normalizeDeviceId(req.get(DEVICE_ID_HEADER));
}

export function requireRequestDeviceId(req) {
  const deviceId = getRequestDeviceId(req);
  if (!deviceId) {
    throw ApiError.badRequest('This browser needs a valid device identifier. Enable site storage and try again.');
  }
  return deviceId;
}

export function hashDeviceId(deviceId) {
  return crypto.createHash('sha256').update(deviceId).digest('hex');
}

export function isStudent(user) {
  return canonicalRole(user?.role) === ROLES.USER;
}

export async function bindOrVerifyStudentDevice(user, req, UserModel) {
  if (!isStudent(user)) return user;
  const deviceId = requireRequestDeviceId(req);
  const deviceHash = hashDeviceId(deviceId);
  if (user.deviceBindingHash && user.deviceBindingHash !== deviceHash) {
    throw ApiError.forbidden('This student account is bound to another device. Ask an authorized HOD or administrator to reset device access.');
  }
  if (user.deviceBindingHash) return user;

  const now = new Date();
  const boundUser = await UserModel.findOneAndUpdate(
    {
      _id: user._id,
      role: { $in: roleValues(ROLES.USER) },
      $or: [{ deviceBindingHash: null }, { deviceBindingHash: { $exists: false } }],
    },
    { $set: { role: ROLES.USER, deviceBindingHash: deviceHash, deviceBoundAt: now } },
    { new: true },
  ).select('+deviceBindingHash');
  if (!boundUser) {
    throw ApiError.forbidden('This student account was bound from another device. Ask an authorized HOD or administrator to reset device access.');
  }
  user.deviceBindingHash = boundUser.deviceBindingHash;
  user.deviceBoundAt = boundUser.deviceBoundAt;
  return user;
}
