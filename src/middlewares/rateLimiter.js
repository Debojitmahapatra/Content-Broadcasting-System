import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Broadcast limiter — public endpoint, keyed by IP.
 * 100 requests per minute per IP address.
 */
export const broadcastLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: {
    status: 'error',
    message: 'Too many requests. Please try again in a minute.',
  },
});

/**
 * Upload limiter — authenticated endpoint, keyed by user ID.
 * 30 uploads per hour per user.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user_${req.user.id}` : ipKeyGenerator(req)),
  message: {
    status: 'error',
    message: 'Upload limit reached. You can upload up to 30 files per hour.',
  },
});

/**
 * Login limiter — 5 attempts per minute per IP to slow brute-force attacks.
 */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: {
    status: 'error',
    message: 'Too many login attempts. Please wait a minute and try again.',
  },
});
