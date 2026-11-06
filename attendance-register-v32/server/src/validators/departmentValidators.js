import { body } from 'express-validator';

export const createDepartmentValidator = [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('code').trim().notEmpty().withMessage('Department code is required').isLength({ max: 10 }),
  body('programLevel').optional().isIn(['certificate', 'diploma', 'degree', 'postgraduate', 'other']),
  body('semesterCount').optional().isInt({ min: 1, max: 20 }).toInt(),
];

export const updateDepartmentValidator = [
  body('name').optional().trim().notEmpty(),
  body('code').optional().trim().isLength({ max: 10 }),
  body('isActive').optional().isBoolean(),
  body('programLevel').optional().isIn(['certificate', 'diploma', 'degree', 'postgraduate', 'other']),
  body('semesterCount').optional().isInt({ min: 1, max: 20 }).toInt(),
];
