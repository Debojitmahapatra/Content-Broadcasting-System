import { Router } from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import { validateFileContent } from '../middlewares/fileFilter.js';
import { uploadContentValidator } from '../validators/contentValidator.js';
import { validateRequest } from '../middlewares/validationHandler.js';
import { uploadLimiter } from '../middlewares/rateLimiter.js';
import {
  uploadContent,
  getMyContent,
  getContentById,
  deleteContent,
} from '../controllers/contentController.js';

const router = Router();

router.use(authMiddleware);

router.post(
  '/upload',
  uploadLimiter,
  upload.single('file'),
  validateFileContent,
  uploadContentValidator,
  validateRequest,
  uploadContent
);
router.get('/my-uploads', getMyContent);
router.get('/:id', getContentById);
router.delete('/:id', deleteContent);

export default router;
