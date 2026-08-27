import express from 'express';
import multer from 'multer';
import * as controller from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';
import { profilePhotoLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) callback(null, true);
    else callback(Object.assign(new Error('Only JPG, PNG and WebP images are allowed.'), { statusCode: 422, code: 'INVALID_PROFILE_IMAGE' }));
  },
});

router.post('/registration-photo', profilePhotoLimiter, upload.single('photo'), controller.uploadRegistrationPhoto);
router.post('/profile-photo', protect, profilePhotoLimiter, upload.single('photo'), controller.uploadProfilePhoto);

export default router;
