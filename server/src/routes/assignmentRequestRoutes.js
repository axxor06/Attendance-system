import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { assignmentRequestLimiter } from '../middleware/rateLimiters.js';
import * as controller from '../controllers/assignmentRequestController.js';
import { createAssignmentRequestValidator, decideAssignmentRequestValidator } from '../validators/assignmentRequestValidators.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);
router.use(protect);
router.get('/', controller.listAssignmentRequests);
router.post('/', assignmentRequestLimiter, rejectUnknownBodyFields(['timetableId', 'dayOfWeek', 'slotId', 'reason']), createAssignmentRequestValidator, validate, controller.createAssignmentRequest);
router.patch('/:id/decision', assignmentRequestLimiter, rejectUnknownBodyFields(['status', 'replacementFaculty', 'decisionReason']), decideAssignmentRequestValidator, validate, controller.decideAssignmentRequest);

export default router;
