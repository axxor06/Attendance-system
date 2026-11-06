import { body } from 'express-validator';

export const createSemesterValidator = [
  body('number').isInt({ min: 1, max: 20 }).withMessage('Semester number must be between 1 and 20'),
  body('departmentId').optional().isMongoId().withMessage('Department identifier must be valid.'),
  body('label').optional().trim(),
];

export const updateSemesterValidator = [
  body('number').optional().isInt({ min: 1, max: 20 }),
  body('isActive').optional().isBoolean(),
];
