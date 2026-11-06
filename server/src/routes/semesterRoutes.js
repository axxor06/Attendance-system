import express from 'express';
import * as controller from '../controllers/semesterController.js';
import * as v from '../validators/semesterValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

router.use(protect);

router.get('/', controller.getSemesters);
router.get('/:id', controller.getSemesterById);

router.post('/', authorize(ROLES.SUPER_ADMIN), rejectUnknownBodyFields(['number', 'departmentId', 'label']), v.createSemesterValidator, validate, controller.createSemester);
router.patch('/:id', authorize(ROLES.SUPER_ADMIN), rejectUnknownBodyFields(['number', 'isActive']), v.updateSemesterValidator, validate, controller.updateSemester);
router.delete('/:id', authorize(ROLES.SUPER_ADMIN), rejectUnknownBodyFields([]), controller.deleteSemester);

export default router;
