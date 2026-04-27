/**
 * Request timeout middleware.
 * Responds with 503 if a request takes longer than REQUEST_TIMEOUT_MS (default 30 s).
 * Uses the connect-timeout package.
 */

import connectTimeout from 'connect-timeout';

const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);

/**
 * Halt middleware — stops processing after a timeout fires.
 * Must be placed AFTER connectTimeout() in the middleware chain.
 */
function haltOnTimeout(req, res, next) {
  if (!req.timedout) return next();
  // globalErrorHandler will pick up err.timeout = true
  const err = new Error('Request timed out.');
  err.timeout = true;
  next(err);
}

export const timeoutMiddleware = connectTimeout(TIMEOUT_MS);
export const haltOnTimedout = haltOnTimeout;
