import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

const ID_KEYS = new Set([
  'id',
  'subjectId',
  'studentId',
  'classId',
  'departmentId',
  'semesterId',
  'attendanceId',
  'sessionId',
  'qrSessionId',
  'requestId',
  'facultyId',
]);

function validateValue(key, value) {
  if (value === undefined || value === null || value === '') return;
  if (Array.isArray(value) || !mongoose.Types.ObjectId.isValid(String(value))) {
    throw ApiError.badRequest(`Invalid ${key}.`);
  }
}

export function objectIdInputGuard(req, _res, next) {
  for (const [key, value] of Object.entries(req.params || {})) {
    if (ID_KEYS.has(key)) validateValue(key, value);
  }
  for (const [key, value] of Object.entries(req.query || {})) {
    if (ID_KEYS.has(key)) validateValue(key, value);
  }
  next();
}
