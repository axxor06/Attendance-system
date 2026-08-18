import express from 'express';
import * as controller from '../controllers/registrationRequestController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';
import { registrationRequestLimiter, registrationStatusLimiter } from '../middleware/rateLimiters.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

const strongPasswordValidator = body('password')
  .isLength({ min: 12 })
  .withMessage(PASSWORD_POLICY_MESSAGE)
  .custom((value) => {
    if (!isStrongPassword(value)) throw new Error(PASSWORD_POLICY_MESSAGE);
    return true;
  });

// Public: student submits a request (no auth needed)
router.post('/', registrationRequestLimiter, [
  body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  strongPasswordValidator,
  body('registerNumber').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('classId').isMongoId().withMessage('Valid class required'),
], validate, controller.submitRequest);

// Public: student checks status of their own request
router.get('/status', registrationStatusLimiter, [
  query('requestId').isMongoId().withMessage('Valid request id required'),
  query('statusToken').isString().isLength({ min: 32, max: 128 }).withMessage('Valid private status token required'),
], validate, controller.checkRequestStatus);

// HOD/SUPER_ADMIN review endpoints
router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HOD));
router.get('/', controller.listRequests);
router.post('/:id/approve', controller.approveRequest);
router.post('/:id/reject', [
  body('reason').optional().trim().isLength({ max: 500 }),
], validate, controller.rejectRequest);

export default router;
