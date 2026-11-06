import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

export function validateObjectIdParam(_req, _res, next, value, name) {
  if (!mongoose.Types.ObjectId.isValid(value)) throw ApiError.badRequest(`Invalid ${name}.`);
  next();
}
