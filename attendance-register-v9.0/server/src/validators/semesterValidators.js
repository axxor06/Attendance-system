import { body } from 'express-validator';

export const createSemesterValidator = [
  body('number').isInt({ min: 1, max: 12 }).withMessage('Semester number must be between 1 and 12'),
  body('label').optional().trim(),
];

export const updateSemesterValidator = [
  body('number').optional().isInt({ min: 1, max: 12 }),
  body('isActive').optional().isBoolean(),
];
