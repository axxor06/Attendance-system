import { body } from 'express-validator';

export const createClassValidator = [
  body('department').isMongoId().withMessage('A valid department is required'),
  body('semester').isMongoId().withMessage('A valid semester is required'),
  body('classTeacher').optional().isMongoId(),
];

export const updateClassValidator = [
  body('classTeacher').optional({ nullable: true }).isMongoId(),
  body('isActive').optional().isBoolean(),
];
