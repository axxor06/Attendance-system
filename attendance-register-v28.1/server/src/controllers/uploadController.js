import asyncHandler from 'express-async-handler';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { uploadProfileImage } from '../services/imagekitService.js';

export const uploadRegistrationPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please select a profile image.');
  const image = await uploadProfileImage(req.file, { purpose: 'registration-photo' });
  return sendResponse(res, 201, 'Profile photo uploaded.', { image });
});

export const uploadProfilePhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please select a profile image.');
  const image = await uploadProfileImage(req.file, { userId: req.user._id, purpose: 'profile-photo' });
  return sendResponse(res, 201, 'Profile photo uploaded.', { image });
});
