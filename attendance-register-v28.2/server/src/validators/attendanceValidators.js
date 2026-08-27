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
