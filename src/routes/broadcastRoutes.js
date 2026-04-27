import { Router } from 'express';
import { getLiveContent } from '../controllers/broadcastController.js';
import { broadcastValidator } from '../validators/broadcastValidator.js';
import { validateRequest } from '../middlewares/validationHandler.js';
import { broadcastLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.get('/live/:teacherId', broadcastLimiter, broadcastValidator, validateRequest, getLiveContent);

export default router;
