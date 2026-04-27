import { Router } from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import restrictTo from '../middlewares/roleMiddleware.js';
import { validateRequest } from '../middlewares/validationHandler.js';
import { getAllContent, getPendingContent, approveContent, rejectContent } from '../controllers/approvalController.js';
import { rejectValidator } from '../validators/approvalValidator.js';

const router = Router();

router.use(authMiddleware, restrictTo('principal'));

router.get('/', getAllContent);          // ?status=pending|approved|rejected  (omit for all)
router.get('/pending', getPendingContent); // kept for backwards compatibility
router.post('/approve/:contentId', approveContent);
router.post('/reject/:contentId', rejectValidator, validateRequest, rejectContent);

export default router;
