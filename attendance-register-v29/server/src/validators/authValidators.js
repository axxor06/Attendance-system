import { body } from 'express-validator';
import { OTP_PURPOSE } from '../config/constants.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';
import { isValidDateOnly } from '../utils/dateOfBirth.js';
import { isAllowedProfileImageUrl } from '../services/imagekitService.js';

const strongPassword = (field, label = 'Password') => body(field)
  .isLength({ min: 12 }).withMessage(PASSWORD_POLICY_MESSAGE)
  .custom((value) => {
    if (!isStrongPassword(value)) throw new Error(PASSWORD_POLICY_MESSAGE);
    return true;
  });

export const loginValidator = [
  body('identifier').trim().notEmpty().withMessage('Email or register number is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const verifyEmailValidator = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('otp').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP code'),
];

export const resendOtpValidator = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('purpose').optional().isIn(Object.values(OTP_PURPOSE)).withMessage('Invalid OTP purpose'),
];

export const forgotPasswordValidator = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
];

export const verifyResetOtpValidator = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('otp').isLength({ min: 4, max: 8 }).isNumeric().withMessage('Enter a valid reset code.'),
];

export const resetPasswordValidator = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('otp').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP code'),
  strongPassword('newPassword', 'New password'),
];

export const updateMeValidator = [
  body('name').optional().trim().notEmpty(),
  body('phone').optional({ values: 'falsy' }).trim(),
  body('employeeId').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('dateOfBirth').optional({ values: 'falsy' }).custom((value) => isValidDateOnly(value)).withMessage('Date of birth must be a valid non-future date in YYYY-MM-DD format.'),
  body('designation').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('qualification').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('admissionYear').optional({ values: 'falsy' }).isInt({ min: 2000, max: 2200 }).toInt(),
  body('avatarUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }).custom((value) => {
    if (!isAllowedProfileImageUrl(value)) throw new Error('Profile photo must be uploaded through configured image storage.');
    return true;
  }),
  body('department').optional().isMongoId().withMessage('Department identifier must be valid.'),
  body('departmentChangeConfirmed').optional().isBoolean().withMessage('Department change confirmation must be boolean.').toBoolean(),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  strongPassword('newPassword', 'New password'),
];

export const requestEmailChangeValidator = [
  body('newEmail').isEmail().withMessage('A valid email is required').normalizeEmail(),
];

export const confirmEmailChangeValidator = [
  body('otp').isLength({ min: 4, max: 8 }).withMessage('Invalid OTP code'),
];
