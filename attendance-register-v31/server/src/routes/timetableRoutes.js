import express from 'express';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';
import * as controller from '../controllers/timetableController.js';
import { availabilityQueryValidator, listTimetableQueryValidator, upsertTimetableValidator } from '../validators/timetableValidators.js';

const router = express.Router();
router.param('classId', validateObjectIdParam);
router.use(protect);

router.get('/', listTimetableQueryValidator, validate, controller.listTimetables);
router.get('/availability', authorize(ROLES.SUPER_ADMIN), availabilityQueryValidator, validate, controller.getAvailableFaculty);
router.get('/:classId', controller.getTimetable);
router.put('/:classId', authorize(ROLES.SUPER_ADMIN), rejectUnknownBodyFields(['days']), upsertTimetableValidator, validate, controller.upsertTimetable);

export default router;
