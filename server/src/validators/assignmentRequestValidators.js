import { body } from 'express-validator';
import { ASSIGNMENT_REQUEST_STATUS, DAYS_OF_WEEK } from '../config/constants.js';

export const createAssignmentRequestValidator = [
  body('timetableId').isMongoId().withMessage('A valid timetable is required.'),
  body('dayOfWeek').isIn(DAYS_OF_WEEK).withMessage('A valid timetable day is required.'),
  body('slotId').isMongoId().withMessage('A valid timetable slot is required.'),
  body('reason').trim().isLength({ min: 5, max: 1000 }).withMessage('The inability reason must be between 5 and 1000 characters.'),
];

export const decideAssignmentRequestValidator = [
  body('status').isIn([ASSIGNMENT_REQUEST_STATUS.ACCEPTED, ASSIGNMENT_REQUEST_STATUS.REJECTED]).withMessage('Decision must be accepted or rejected.'),
  body('replacementFaculty').optional({ values: 'falsy' }).isMongoId().withMessage('Replacement Faculty must be a valid account.'),
  body('decisionReason').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }).withMessage('Decision reason may not exceed 1000 characters.'),
  body('decisionReason').custom((value, { req }) => {
    if (req.body.status === ASSIGNMENT_REQUEST_STATUS.REJECTED && (!value || String(value).trim().length < 5)) {
      throw new Error('A rejection reason of at least 5 characters is required.');
    }
    if (req.body.status === ASSIGNMENT_REQUEST_STATUS.ACCEPTED && (!req.body.replacementFaculty || !String(req.body.replacementFaculty).trim())) {
      throw new Error('A replacement Faculty member is required when accepting this request.');
    }
    return true;
  }),
];
