import express from 'express';
import * as controller from '../controllers/subjectController.js';
import * as v from '../validators/subjectValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

router.use(protect);

router.get('/my-subjects', authorize(ROLES.FACULTY), controller.getMySubjects);
router.get('/', controller.getSubjects);
router.get('/:id', controller.getSubjectById);

router.use(authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HOD));
router.post('/', v.createSubjectValidator, validate, controller.createSubject);
router.patch('/:id', v.updateSubjectValidator, validate, controller.updateSubject);
router.delete('/:id', controller.deleteSubject);

export default router;
