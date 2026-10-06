import { body } from 'express-validator';
import { LEAVE_STATUS } from '../config/constants.js';

export const createLeaveRequestValidator = [
  body('reason').trim().isLength({ min: 5, max: 2000 }).withMessage('Leave reason must be between 5 and 2000 characters.'),
];

export const decideLeaveRequestValidator = [
  body('status').isIn([LEAVE_STATUS.APPROVED, LEAVE_STATUS.REJECTED]).withMessage('Decision must be approved or rejected.'),
  body('decisionReason').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }).withMessage('Decision reason may not exceed 1000 characters.'),
  body('decisionReason').custom((value, { req }) => {
    if (req.body.status === LEAVE_STATUS.REJECTED && (!value || String(value).trim().length < 5)) {
      throw new Error('A rejection reason of at least 5 characters is required.');
    }
    return true;
  }),
];
