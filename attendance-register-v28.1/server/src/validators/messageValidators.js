import { body, param, query } from 'express-validator';

const pageFields = [
  query('page').optional().isInt({ min: 1, max: 10000 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50.'),
];

export const recipientListValidator = [
  ...pageFields,
  query('search').optional().trim().isLength({ max: 80 }).withMessage('Search may not exceed 80 characters.'),
  query('group').optional().isIn(['all', 'students', 'faculty', 'hod', 'tutors']).withMessage('Group must be a supported messaging category.'),
];

export const messageProfileValidator = [param('userId').isMongoId().withMessage('A valid profile is required.')];

export const conversationListValidator = [...pageFields];

export const conversationIdValidator = [param('conversationId').isMongoId().withMessage('A valid conversation is required.')];

export const createConversationValidator = [
  body('recipientId').isMongoId().withMessage('A valid recipient is required.'),
];

export const messageListValidator = [
  ...pageFields,
  ...conversationIdValidator,
];

export const sendMessageValidator = [
  ...conversationIdValidator,
  body('body').isString().withMessage('Message text is required.').trim().isLength({ min: 1, max: 5000 }).withMessage('Message text must contain between 1 and 5000 characters.'),
];

export const readConversationValidator = [...conversationIdValidator];

export const editMessageValidator = [
  ...conversationIdValidator,
  param('messageId').isMongoId().withMessage('A valid message is required.'),
  body('body').isString().withMessage('Message text is required.').trim().isLength({ min: 1, max: 5000 }).withMessage('Message text must contain between 1 and 5000 characters.'),
];

export const deleteMessageValidator = [
  ...conversationIdValidator,
  param('messageId').isMongoId().withMessage('A valid message is required.'),
  body('mode').isIn(['me', 'everyone']).withMessage('Delete mode must be me or everyone.'),
];
