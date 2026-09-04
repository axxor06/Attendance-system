import express from 'express';
import * as controller from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';
import { messageSendLimiter } from '../middleware/rateLimiters.js';
import {
  conversationListValidator,
  createConversationValidator,
  messageListValidator,
  recipientListValidator,
  messageProfileValidator,
  readConversationValidator,
  sendMessageValidator,
  editMessageValidator,
  deleteMessageValidator,
} from '../validators/messageValidators.js';

const router = express.Router();
router.use(protect);
router.param('conversationId', validateObjectIdParam);

router.get('/recipients', recipientListValidator, validate, controller.listMessageRecipients);
router.get('/profiles/:userId', validateObjectIdParam, messageProfileValidator, validate, controller.getMessageProfile);
router.get('/conversations', conversationListValidator, validate, controller.listConversations);
router.post('/conversations', messageSendLimiter, rejectUnknownBodyFields(['recipientId']), createConversationValidator, validate, controller.createConversation);
router.get('/conversations/:conversationId/messages', messageListValidator, validate, controller.listConversationMessages);
router.post('/conversations/:conversationId/messages', messageSendLimiter, rejectUnknownBodyFields(['body']), sendMessageValidator, validate, controller.sendConversationMessage);
router.patch('/conversations/:conversationId/messages/:messageId', messageSendLimiter, rejectUnknownBodyFields(['body']), editMessageValidator, validate, controller.editConversationMessage);
router.delete('/conversations/:conversationId/messages/:messageId', messageSendLimiter, rejectUnknownBodyFields(['mode']), deleteMessageValidator, validate, controller.deleteConversationMessage);
router.patch('/conversations/:conversationId/read', rejectUnknownBodyFields([]), readConversationValidator, validate, controller.markConversationRead);

export default router;
