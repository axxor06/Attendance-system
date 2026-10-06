import express from 'express';
import * as controller from '../controllers/userController.js';
import * as v from '../validators/userValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

router.use(protect);
router.get('/assigned-students', authorize(ROLES.ADMIN), v.userListQueryValidator, validate, controller.getAssignedStudents);
router.get('/:id/summary', controller.getUserSummary);
router.get('/:id', controller.getUserById);
router.patch('/:id', rejectUnknownBodyFields(['name', 'email', 'phone', 'dateOfBirth', 'designation', 'qualification', 'admissionYear', 'registerNumber', 'employeeId', 'department', 'classId', 'isActive', 'avatarUrl']), v.updateUserValidator, validate, controller.updateUser);

router.use(authorize(ROLES.SUPER_ADMIN));
router.post('/', rejectUnknownBodyFields(['name', 'email', 'role', 'registerNumber', 'employeeId', 'department', 'classId', 'phone', 'dateOfBirth', 'designation', 'qualification', 'admissionYear', 'avatarUrl', 'password']), v.createUserValidator, validate, controller.createUser);
router.get('/', v.userListQueryValidator, validate, controller.getUsers);
router.delete('/:id', rejectUnknownBodyFields([]), controller.deleteUser);
router.post('/:id/reset-password', rejectUnknownBodyFields(['newPassword']), v.resetUserPasswordValidator, validate, controller.resetUserPassword);
router.post('/:id/reset-device', rejectUnknownBodyFields([]), controller.resetStudentDevice);

export default router;
