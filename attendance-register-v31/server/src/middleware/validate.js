import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

/**
 * Runs after express-validator chains. If any validation failed,
 * throws a 400 ApiError with a flat list of human-readable messages.
 */
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const messages = errors.array().map((e) => e.msg);
  throw ApiError.badRequest('Validation failed', messages);
}
