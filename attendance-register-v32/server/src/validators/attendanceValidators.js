import { body, query } from 'express-validator';
import { ATTENDANCE_STATUS_LIST } from '../config/constants.js';

export const markAttendanceValidator = [
  body('subjectId').isMongoId().withMessage('A valid subject is required'),
  body('date').isISO8601().withMessage('A valid date is required'),
  body('periodOrder').isInt({ min: 1 }).withMessage('A valid period order is required'),
  body('entries').isArray({ min: 1 }).withMessage('At least one attendance entry is required'),
  body('entries.*.studentId').isMongoId().withMessage('Each entry needs a valid student id'),
  body('entries.*.status').isIn(ATTENDANCE_STATUS_LIST).withMessage('Invalid attendance status'),
];

export const getSessionRosterValidator = [
  query('subjectId').isMongoId().withMessage('A valid subject is required'),
  query('date').isISO8601().withMessage('A valid date is required'),
  query('periodOrder').isInt({ min: 1 }).withMessage('A valid period order is required'),
];

export const editAttendanceValidator = [
  body('status').isIn(ATTENDANCE_STATUS_LIST).withMessage('Invalid attendance status'),
];

export const editAttendanceReasonValidator = [
  body('reason').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }).withMessage('Reason may not exceed 300 characters.'),
  body('remarks').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }).withMessage('Remarks may not exceed 300 characters.'),
];

export const correctableSessionsValidator = [
  query('date').isISO8601({ strict: true }).withMessage('A valid date is required.'),
  query('classId').optional().isMongoId().withMessage('Invalid class.'),
];

export const correctionRosterValidator = [
  query('subjectId').isMongoId().withMessage('A valid subject is required.'),
  query('date').isISO8601({ strict: true }).withMessage('A valid date is required.'),
  query('periodOrder').isInt({ min: 1, max: 24 }).withMessage('A valid period is required.'),
];

export const submitCorrectionsValidator = [
  body('subjectId').isMongoId().withMessage('A valid subject is required.'),
  body('date').isISO8601({ strict: true }).withMessage('A valid date is required.'),
  body('periodOrder').isInt({ min: 1, max: 24 }).withMessage('A valid period is required.'),
  body('reason').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }).withMessage('Reason may not exceed 300 characters.'),
  body('changes').isArray({ min: 1, max: 200 }).withMessage('Choose between 1 and 200 students to correct.'),
  body('changes.*.studentId').isMongoId().withMessage('Each change needs a valid student.'),
  body('changes.*.status').isIn(ATTENDANCE_STATUS_LIST).withMessage('Invalid attendance status.'),
  body('changes.*.remarks').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }).withMessage('Remarks may not exceed 300 characters.'),
];

export const listCorrectionsValidator = [
  query('classId').optional().isMongoId().withMessage('Invalid class.'),
  query('subjectId').optional().isMongoId().withMessage('Invalid subject.'),
  query('studentId').optional().isMongoId().withMessage('Invalid student.'),
  query('facultyId').optional().isMongoId().withMessage('Invalid faculty.'),
  query('from').optional().isISO8601({ strict: true }).withMessage('Invalid start date.'),
  query('to').optional().isISO8601({ strict: true }).withMessage('Invalid end date.'),
];
