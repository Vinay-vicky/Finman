const AppError = require('../utils/appError');
const logger = require('../utils/logger');

const notFoundHandler = (req, res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = Boolean(err.isOperational);

  if (!isOperational && statusCode >= 500) {
    logger.error('Unhandled server error', {
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(err.details ? { details: err.details } : {}),
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
