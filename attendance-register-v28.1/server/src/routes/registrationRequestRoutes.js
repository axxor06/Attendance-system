import express from 'express';
import * as controller from '../controllers/registrationRequestController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';
import { isValidDateOnly } from '../utils/dateOfBirth.js';
import { isAllowedProfileImageUrl } from '../services/imagekitService.js';
import { registrationRequestLimiter, registrationStatusLimiter } from '../middleware/rateLimiters.js';
import { validateObjectIdParam } from '../middleware/objectIdParam.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

const strongPasswordValidator = body('password')
  .isLength({ min: 12 })
  .withMessage(PASSWORD_POLICY_MESSAGE)
  .custom((value) => {
    if (!isStrongPassword(value)) throw new Error(PASSWORD_POLICY_MESSAGE);
    return true;
  });

// Public: student or faculty submits a request (no auth needed)
router.post('/', registrationRequestLimiter, rejectUnknownBodyFields(['requestedRole', 'name', 'email', 'password', 'phone', 'dateOfBirth', 'avatarUrl', 'classId', 'departmentId']), [
  body('requestedRole').optional().isIn(['student', 'faculty']).withMessage('Choose student or faculty request type.'),
  body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  strongPasswordValidator,
  body('registerNumber').not().exists().withMessage('Register number is assigned by the HOD after approval.'),
  body('employeeId').not().exists().withMessage('Employee ID is assigned by the HOD after approval.'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('dateOfBirth').optional({ values: 'falsy' }).custom((value) => isValidDateOnly(value)).withMessage('Date of birth must be a valid non-future date in YYYY-MM-DD format.'),
  body('avatarUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Invalid profile photo URL.').custom((value) => {
    if (!isAllowedProfileImageUrl(value)) throw new Error('Profile photo must be uploaded through configured image storage.');
    return true;
  }),
  body('classId').optional({ values: 'falsy' }).custom((value, { req }) => {
    if (req.body.requestedRole !== 'faculty' && !/^[a-f\d]{24}$/i.test(String(value))) throw new Error('Valid class required');
    return true;
  }),
  body('departmentId').optional({ values: 'falsy' }).custom((value, { req }) => {
    if (req.body.requestedRole === 'faculty' && !/^[a-f\d]{24}$/i.test(String(value))) throw new Error('Valid department required');
    return true;
  }),
], validate, controller.submitRequest);

// Public: student checks status with a short reference; legacy private links remain accepted during migration.
router.get('/status', registrationStatusLimiter, [
  query('code').optional({ values: 'falsy' }).matches(/^AR-[A-Z0-9]{4}-[A-Z0-9]{6}$/i).withMessage('Enter a valid status reference such as AR-7K4P-92XM.'),
  query('requestId').optional({ values: 'falsy' }).custom((value, { req }) => {
    if (req.query.code) return true;
    if (!/^[a-f\d]{24}$/i.test(String(value))) throw new Error('Enter a valid status reference.');
    return true;
  }),
  query('statusToken').optional({ values: 'falsy' }).custom((value, { req }) => {
    if (req.query.code) return true;
    if (typeof value !== 'string' || value.length < 32 || value.length > 128) throw new Error('Enter a valid status reference.');
    return true;
  }),
  query('code').custom((value, { req }) => {
    if (value || (req.query.requestId && req.query.statusToken)) return true;
    throw new Error('Enter your status reference.');
  }),
], validate, controller.checkRequestStatus);

// HOD/SUPER_ADMIN review endpoints
router.use(protect, authorize(ROLES.SUPER_ADMIN));
router.get('/', controller.listRequests);
router.post('/:id/approve', rejectUnknownBodyFields(['identifier']), [
  body('identifier').trim().notEmpty().isLength({ max: 80 }).withMessage('A unique identifier assigned by the HOD is required.'),
], validate, controller.approveRequest);
router.post('/:id/reject', rejectUnknownBodyFields(['reason']), [
  body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('A rejection reason of at least 5 characters is required.'),
], validate, controller.rejectRequest);

export default router;
