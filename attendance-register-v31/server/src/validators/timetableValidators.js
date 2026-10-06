import { body, query } from 'express-validator';
import { DAYS_OF_WEEK, PERIOD_KIND } from '../config/constants.js';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const upsertTimetableValidator = [
  body('days').isArray({ max: DAYS_OF_WEEK.length }).withMessage('days must be an array with at most seven entries.'),
  body('days').custom((days) => {
    const seenDays = new Set();
    for (const day of days) {
      if (!day || !DAYS_OF_WEEK.includes(day.dayOfWeek)) throw new Error('Every timetable day must use a valid weekday.');
      if (seenDays.has(day.dayOfWeek)) throw new Error('A timetable cannot contain a weekday more than once.');
      seenDays.add(day.dayOfWeek);
      if (!Array.isArray(day.slots) || day.slots.length > 24) throw new Error('Each timetable day may contain at most 24 slots.');
      const seenOrders = new Set();
      for (const slot of day.slots) {
        if (!slot || !Number.isInteger(Number(slot.order)) || Number(slot.order) < 1 || Number(slot.order) > 24) throw new Error('Every period order must be an integer between 1 and 24.');
        if (seenOrders.has(Number(slot.order))) throw new Error('Period order values must be unique within a day.');
        seenOrders.add(Number(slot.order));
        if (typeof slot.name !== 'string' || !slot.name.trim() || slot.name.length > 120) throw new Error('Every timetable slot needs a name up to 120 characters.');
        if (slot.kind && !Object.values(PERIOD_KIND).includes(slot.kind)) throw new Error('Invalid timetable slot kind.');
        if (slot.startTime != null && slot.startTime !== '' && !timePattern.test(slot.startTime)) throw new Error('Invalid period start time.');
        if (slot.endTime != null && slot.endTime !== '' && !timePattern.test(slot.endTime)) throw new Error('Invalid period end time.');
        if ((slot.startTime && !slot.endTime) || (!slot.startTime && slot.endTime) || (slot.startTime && slot.endTime && slot.startTime >= slot.endTime)) throw new Error('Each period needs a valid start/end time range.');
        if (slot.subject != null && !/^[a-f\d]{24}$/i.test(String(slot.subject))) throw new Error('Invalid timetable subject id.');
        if (slot.faculty != null && !/^[a-f\d]{24}$/i.test(String(slot.faculty))) throw new Error('Invalid timetable Faculty id.');
        if (slot.note != null && String(slot.note).length > 240) throw new Error('Timetable notes may not exceed 240 characters.');
      }
    }
    return true;
  }),
];

export const listTimetableQueryValidator = [
  query('department').optional().isMongoId(),
  query('semester').optional().isMongoId(),
  query('classId').optional().isMongoId(),
];

export const availabilityQueryValidator = [
  query('classId').isMongoId().withMessage('classId must be a valid identifier.'),
  query('subjectId').optional().isMongoId().withMessage('subjectId must be a valid identifier.'),
  query('dayOfWeek').isIn(DAYS_OF_WEEK).withMessage('dayOfWeek must be a valid weekday.'),
  query('order').isInt({ min: 1, max: 24 }).withMessage('order must be between 1 and 24.'),
  query('startTime').optional().matches(timePattern).withMessage('startTime must use HH:mm format.'),
  query('endTime').optional().matches(timePattern).withMessage('endTime must use HH:mm format.'),
  query('excludeTimetableId').optional().isMongoId(),
  query('slotId').optional().isMongoId(),
];
