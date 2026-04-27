/**
 * Custom operational error class.
 * Operational errors are expected (404, 401, 422 etc.) and safe to expose to clients.
 * Programming errors (bugs) are NOT operational and should not leak details.
 */
class AppError extends Error {
  /**
   * @param {string} message   - Human-readable error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
