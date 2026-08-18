import { body } from 'express-validator';
import { OTP_PURPOSE } from '../config/constants.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';

const strongPassword = (field, label = 'Password') => body(field)
  .isLength({ min: 12 }).withMessage(PASSWORD_POLICY_MESSAGE)
  .custom((value) => {
    if (!isStrongPassword(value)) throw new Error(PASSWORD_POLICY_MESSAGE);
    return true;
  });

export const registerStudentValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  strongPassword('password'),
  body('registerNumber').optional().trim(),
  body('classId').optional().isMongoId().withMessage('Invalid class id'),
];

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
  body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim(),
  body('avatarUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  strongPassword('newPassword', 'New password'),
];
