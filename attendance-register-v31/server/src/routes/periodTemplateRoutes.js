import express from 'express';
import * as controller from '../controllers/periodTemplateController.js';
import * as v from '../validators/periodTemplateValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

router.use(protect);

// All authenticated users can view period templates (students need them for timetable)
router.get('/', controller.getActivePeriodTemplates);
router.get('/:day', v.periodTemplateQueryValidator, validate, controller.getPeriodTemplateByDay);

router.use(authorize(ROLES.SUPER_ADMIN));
router.post('/', rejectUnknownBodyFields(['dayOfWeek', 'periods']), v.upsertPeriodTemplateValidator, validate, controller.upsertPeriodTemplate);
router.patch('/:id/deactivate', rejectUnknownBodyFields([]), controller.deactivatePeriodTemplate);

export default router;
