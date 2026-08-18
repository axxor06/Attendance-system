import { body } from 'express-validator';

export const createDepartmentValidator = [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('code').trim().notEmpty().withMessage('Department code is required').isLength({ max: 10 }),
];

export const updateDepartmentValidator = [
  body('name').optional().trim().notEmpty(),
  body('code').optional().trim().isLength({ max: 10 }),
  body('isActive').optional().isBoolean(),
];
