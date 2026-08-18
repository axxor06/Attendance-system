import express from 'express';
import * as controller from '../controllers/departmentController.js';
import * as v from '../validators/departmentValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

router.use(protect);

router.get('/', controller.getDepartments);
router.get('/:id', controller.getDepartmentById);

router.use(authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));
router.post('/', v.createDepartmentValidator, validate, controller.createDepartment);
router.patch('/:id', v.updateDepartmentValidator, validate, controller.updateDepartment);
router.delete('/:id', controller.deleteDepartment);

export default router;
