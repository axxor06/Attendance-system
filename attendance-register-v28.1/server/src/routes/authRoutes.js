import express from 'express';
import * as authController from '../controllers/authController.js';
import * as v from '../validators/authValidators.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { cookieOriginGuard } from '../middleware/cookieOriginGuard.js';
import { rejectUnknownBodyFields } from '../middleware/strictBody.js';
import {
  loginLimiter,
  otpGenerateLimiter,
  otpVerifyLimiter,
  forgotPasswordLimiter,
  passwordResetLimiter,
  passwordChangeLimiter,
  refreshLimiter,
} from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/verify-email', otpVerifyLimiter, rejectUnknownBodyFields(['email', 'otp']), v.verifyEmailValidator, validate, authController.verifyEmail);
router.post('/resend-otp', otpGenerateLimiter, rejectUnknownBodyFields(['email', 'purpose']), v.resendOtpValidator, validate, authController.resendOtp);
router.post('/login', loginLimiter, rejectUnknownBodyFields(['identifier', 'password']), v.loginValidator, validate, authController.login);
router.post('/refresh', cookieOriginGuard, refreshLimiter, rejectUnknownBodyFields([]), authController.refresh);
router.post('/logout', cookieOriginGuard, refreshLimiter, rejectUnknownBodyFields([]), authController.logout);
router.post('/forgot-password', forgotPasswordLimiter, rejectUnknownBodyFields(['email']), v.forgotPasswordValidator, validate, authController.forgotPassword);
router.post('/verify-reset-otp', passwordResetLimiter, rejectUnknownBodyFields(['email', 'otp']), v.verifyResetOtpValidator, validate, authController.verifyResetOtp);
router.post('/reset-password', passwordResetLimiter, rejectUnknownBodyFields(['email', 'otp', 'newPassword']), v.resetPasswordValidator, validate, authController.resetPassword);

router.use(protect);
router.patch('/me', rejectUnknownBodyFields(['name', 'email', 'phone', 'dateOfBirth', 'designation', 'qualification', 'admissionYear', 'avatarUrl', 'employeeId', 'department', 'departmentChangeConfirmed']), v.updateMeValidator, validate, authController.updateMe);
router.get('/me', authController.getMe);
router.post('/change-password', passwordChangeLimiter, rejectUnknownBodyFields(['currentPassword', 'newPassword']), v.changePasswordValidator, validate, authController.changePassword);

export default router;
