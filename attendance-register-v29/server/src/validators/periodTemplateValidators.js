import { body, query } from 'express-validator';
import { DAYS_OF_WEEK, PERIOD_KIND } from '../config/constants.js';

export const periodTemplateQueryValidator = [
  query('classId').optional().isMongoId().withMessage('classId must be a valid identifier'),
  query('subjectId').optional().isMongoId().withMessage('subjectId must be a valid identifier'),
];

export const upsertPeriodTemplateValidator = [
  body('dayOfWeek').isIn(DAYS_OF_WEEK).withMessage('Invalid day of week'),
  body('periods').isArray({ min: 1 }).withMessage('At least one period is required'),
  body('periods.*.order').isInt({ min: 1 }).withMessage('Each period needs a valid order number'),
  body('periods.*.name').trim().notEmpty().withMessage('Each period needs a name'),
  body('periods.*.kind')
    .optional()
    .isIn(Object.values(PERIOD_KIND))
    .withMessage('Invalid period kind'),
];
