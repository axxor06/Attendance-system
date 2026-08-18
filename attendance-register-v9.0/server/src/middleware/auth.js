import asyncHandler from 'express-async-handler';
import { User } from '../models/index.js';
import { verifyAccessToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';

/**
 * Verifies the Bearer access token from the Authorization header,
 * loads the corresponding user, and attaches it to req.user.
 * Rejects if the user no longer exists or has been deactivated.
 */
export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No access token provided. Please log in.');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired.');
    }
    throw ApiError.unauthorized('Invalid access token.');
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    throw ApiError.unauthorized('User belonging to this token no longer exists.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated.');
  }

  if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
    throw ApiError.unauthorized('Authentication state has changed. Please log in again.');
  }

  req.user = user;
  next();
});

/**
 * Role guard factory. Usage: authorize('hod'), authorize('hod', 'faculty').
 * Must be used after `protect`.
 */
export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    throw ApiError.unauthorized('Not authenticated.');
  }
  if (!allowedRoles.includes(req.user.role)) {
    throw ApiError.forbidden(
      `Role '${req.user.role}' is not permitted to perform this action.`
    );
  }
  next();
};
