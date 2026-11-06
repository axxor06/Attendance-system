import express from 'express';
import * as controller from '../controllers/classController.js';
import * as v from '../validators/classValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

// Public: used by the student self-registration form to pick a class.
router.get('/public-options', controller.getPublicClassOptions);

router.use(protect);

router.get('/', controller.getClasses);
router.get('/:id', controller.getClassById);

router.use(authorize(ROLES.SUPER_ADMIN));
router.post('/', rejectUnknownBodyFields(['department', 'semester', 'classTeacher']), v.createClassValidator, validate, controller.createClass);
router.patch('/:id', rejectUnknownBodyFields(['classTeacher', 'isActive']), v.updateClassValidator, validate, controller.updateClass);
router.delete('/:id', rejectUnknownBodyFields([]), controller.deleteClass);

export default router;
