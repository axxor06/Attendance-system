import { body } from 'express-validator';
import { ROLE_LIST } from '../config/constants.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';

const optionalStrongPassword = (field) => body(field)
  .optional({ values: 'falsy' })
  .isLength({ min: 12 }).withMessage(PASSWORD_POLICY_MESSAGE)
  .custom((value) => {
    if (!isStrongPassword(value)) throw new Error(PASSWORD_POLICY_MESSAGE);
    return true;
  });

export const createUserValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('role').isIn(ROLE_LIST).withMessage('Invalid role'),
  body('registerNumber').optional({ values: 'falsy' }).trim(),
  body('employeeId').optional({ values: 'falsy' }).trim(),
  body('department').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid department id'),
  body('classId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid class id — must be a MongoDB ObjectId, not a class name'),
  optionalStrongPassword('password'),
];

export const updateUserValidator = [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim(),
  body('registerNumber').optional({ values: 'falsy' }).trim(),
  body('employeeId').optional({ values: 'falsy' }).trim(),
  body('department').optional({ values: 'falsy' }).isMongoId(),
  body('classId').optional({ values: 'falsy' }).isMongoId(),
  body('isActive').optional().isBoolean(),
  body('avatarUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }),
];

export const updateMeValidator = [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim(),
  body('avatarUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }),
];

export const resetUserPasswordValidator = [optionalStrongPassword('newPassword')];
