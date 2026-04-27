import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { registerValidator, loginValidator } from '../validators/authValidator.js';
import { validateRequest } from '../middlewares/validationHandler.js';
import { loginLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/register', registerValidator, validateRequest, register);
router.post('/login', loginLimiter, loginValidator, validateRequest, login);

export default router;
