import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Sequelize error normaliser
// ---------------------------------------------------------------------------

function handleSequelizeErrors(err) {
  if (err.name === 'SequelizeUniqueConstraintError') {
    const fields = err.errors.map((e) => e.path).join(', ');
    return new AppError(`Duplicate value for field(s): ${fields}.`, 409);
  }
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map((e) => e.message).join(' ');
    return new AppError(`Validation error: ${messages}`, 422);
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return new AppError('Referenced record does not exist.', 400);
  }
  if (err.name === 'SequelizeDatabaseError') {
    return new AppError('Database error. Please try again.', 500);
  }
  return err;
}

// ---------------------------------------------------------------------------
// Environment-specific response formatters
// ---------------------------------------------------------------------------

function sendDevelopmentError(err, res) {
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message,
    stack: err.stack,
  });
}

function sendProductionError(err, res) {
  if (err.isOperational) {
    res.status(err.statusCode).json({ status: 'error', message: err.message });
  } else {
    logger.error('UNEXPECTED ERROR', { message: err.message, stack: err.stack });
    res.status(500).json({ status: 'error', message: 'Something went wrong. Please try again later.' });
  }
}

// ---------------------------------------------------------------------------
// Global error handler (4-arg signature required by Express)
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
export function globalErrorHandler(err, req, res, next) {
  // Handle connect-timeout
  if (err.timeout) {
    return res.status(503).json({ status: 'error', message: 'Request timed out. Please try again.' });
  }

  let error = err;
  if (err.name && err.name.startsWith('Sequelize')) {
    error = handleSequelizeErrors(err);
  }

  error.statusCode = error.statusCode || 500;

  if (process.env.NODE_ENV === 'development') {
    sendDevelopmentError(error, res);
  } else {
    sendProductionError(error, res);
  }
}

// ---------------------------------------------------------------------------
// asyncWrapper — eliminates try/catch boilerplate in controllers
// ---------------------------------------------------------------------------

export function asyncWrapper(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
