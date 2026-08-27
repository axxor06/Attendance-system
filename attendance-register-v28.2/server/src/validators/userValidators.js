import { body, query } from 'express-validator';
import { ALL_ACCEPTED_ROLE_LIST, ROLE_LIST } from '../config/constants.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';
import { isValidDateOnly } from '../utils/dateOfBirth.js';
import { isAllowedProfileImageUrl } from '../services/imagekitService.js';
import { isValidAcademicIdentifier } from '../utils/identifierPolicy.js';

const optionalStrongPassword = (field) => body(field)
  .optional({ values: 'falsy' })
  .isLength({ min: 12 }).withMessage(PASSWORD_POLICY_MESSAGE)
  .custom((value) => {
    if (!isStrongPassword(value)) throw new Error(PASSWORD_POLICY_MESSAGE);
    return true;
  });

const optionalAcademicIdentifier = (field, label) => body(field)
  .optional({ values: 'falsy' })
  .trim()
  .custom((value) => {
    if (!isValidAcademicIdentifier(value)) throw new Error(`${label} must use 2–80 letters, numbers, spaces, dots, dashes, underscores, or slashes.`);
    return true;
  });

export const createUserValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('role').isIn(ROLE_LIST).withMessage('Invalid role'),
  optionalAcademicIdentifier('registerNumber', 'Register number'),
  optionalAcademicIdentifier('employeeId', 'Employee ID'),
  body('dateOfBirth').optional({ values: 'falsy' }).custom((value) => isValidDateOnly(value)).withMessage('Date of birth must be a valid non-future date in YYYY-MM-DD format.'),
  body('designation').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('qualification').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('admissionYear').optional({ values: 'falsy' }).isInt({ min: 2000, max: 2200 }).toInt(),
  body('department').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid department id'),
  body('classId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid class id — must be a MongoDB ObjectId, not a class name'),
  optionalStrongPassword('password'),
];

export const updateUserValidator = [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim(),
  body('dateOfBirth').optional({ values: 'falsy' }).custom((value) => isValidDateOnly(value)).withMessage('Date of birth must be a valid non-future date in YYYY-MM-DD format.'),
  body('designation').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('qualification').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('admissionYear').optional({ values: 'falsy' }).isInt({ min: 2000, max: 2200 }).toInt(),
  optionalAcademicIdentifier('registerNumber', 'Register number'),
  optionalAcademicIdentifier('employeeId', 'Employee ID'),
  body('department').optional({ values: 'falsy' }).isMongoId(),
  body('classId').optional({ values: 'falsy' }).isMongoId(),
  body('isActive').optional().isBoolean(),
  body('avatarUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }).custom((value) => {
    if (!isAllowedProfileImageUrl(value)) throw new Error('Profile photo must be uploaded through configured image storage.');
    return true;
  }),
];

export const updateMeValidator = [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').optional({ values: 'falsy' }).trim(),
  body('dateOfBirth').optional({ values: 'falsy' }).custom((value) => isValidDateOnly(value)).withMessage('Date of birth must be a valid non-future date in YYYY-MM-DD format.'),
  body('avatarUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }).custom((value) => {
    if (!isAllowedProfileImageUrl(value)) throw new Error('Profile photo must be uploaded through configured image storage.');
    return true;
  }),
];

export const userListQueryValidator = [
  query('role').optional().isIn(ALL_ACCEPTED_ROLE_LIST).withMessage('Invalid user role filter.'),
  query('department').optional().isMongoId().withMessage('Invalid department filter.'),
  query('classId').optional().isMongoId().withMessage('Invalid class filter.'),
  query('semester').optional().isMongoId().withMessage('Invalid semester filter.'),
  query('tutorsOnly').optional().isBoolean().toBoolean().withMessage('Invalid tutor filter.'),
  query('sortBy').optional().isIn(['name', 'department', 'semester', 'class', 'createdAt']).withMessage('Invalid sort field.'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort direction.'),
  query('search').optional().trim().isLength({ max: 80 }).withMessage('Search text must be 80 characters or fewer.'),
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt().withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100.'),
];

export const resetUserPasswordValidator = [optionalStrongPassword('newPassword')];
