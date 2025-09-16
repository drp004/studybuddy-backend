const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = {
      message: 'Validation Error',
      status: 400,
      errors: messages
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    error = {
      message: 'Duplicate field value entered',
      status: 400
    };
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    error = {
      message: 'Resource not found',
      status: 404
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      status: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      status: 401
    };
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'File too large',
      status: 400
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      message: 'Unexpected file field',
      status: 400
    };
  }

  res.status(error.status).json({
    success: false,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(error.stack && { stack: error.stack })
  });
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

module.exports = { errorHandler, notFound }; 