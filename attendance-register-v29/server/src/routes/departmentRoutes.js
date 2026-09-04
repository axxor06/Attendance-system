import express from 'express';
import * as controller from '../controllers/departmentController.js';
import * as v from '../validators/departmentValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

router.get('/public-options', controller.getPublicDepartmentOptions);

router.use(protect);

router.get('/', controller.getDepartments);
router.get('/:id', controller.getDepartmentById);

router.patch('/:id', authorize(ROLES.SUPER_ADMIN), rejectUnknownBodyFields(['name', 'code', 'isActive', 'programLevel', 'semesterCount']), v.updateDepartmentValidator, validate, controller.updateDepartment);
router.use(authorize(ROLES.SUPER_ADMIN));
router.post('/', rejectUnknownBodyFields(['name', 'code', 'programLevel', 'semesterCount']), v.createDepartmentValidator, validate, controller.createDepartment);
router.delete('/:id', rejectUnknownBodyFields([]), controller.deleteDepartment);

export default router;
