import { body } from 'express-validator';

export const createSubjectValidator = [
  body('name').trim().notEmpty().withMessage('Subject name is required'),
  body('code').trim().notEmpty().withMessage('Subject code is required'),
  body('department').isMongoId().withMessage('A valid department is required'),
  body('semester').isMongoId().withMessage('A valid semester is required'),
  body('classId').isMongoId().withMessage('A valid class is required'),
  body('faculty').optional().isArray(),
  body('faculty.*').optional().isMongoId(),
  body('students').optional().isArray(),
  body('students.*').optional().isMongoId(),
];

export const updateSubjectValidator = [
  body('name').optional().trim().notEmpty(),
  body('code').optional().trim().notEmpty(),
  body('faculty').optional().isArray(),
  body('students').optional().isArray(),
  body('isActive').optional().isBoolean(),
];
