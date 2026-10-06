import express from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import * as controller from '../controllers/leaveController.js';
import { createLeaveRequestValidator, decideLeaveRequestValidator } from '../validators/leaveValidators.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);
router.use(protect);
router.get('/', controller.listLeaveRequests);
router.post('/', rejectUnknownBodyFields(['reason']), createLeaveRequestValidator, validate, controller.createLeaveRequest);
router.patch('/:id/decision', rejectUnknownBodyFields(['status', 'decisionReason']), decideLeaveRequestValidator, validate, controller.decideLeaveRequest);

export default router;
