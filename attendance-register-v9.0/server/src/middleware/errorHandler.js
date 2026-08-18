export function notFoundHandler(req, res, next) {
  const err = new Error(`Not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  next(err);
}

export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;
  let code = err.code && typeof err.code === 'string' && err.code.length < 80 ? err.code : 'INTERNAL_SERVER_ERROR';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => e.message);
    message = 'Validation failed';
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  }

  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `A record with that ${field} already exists.` : 'Duplicate entry.';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token. Please log in again.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Session expired. Please log in again.';
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const requestId = req.id || req.get('X-Request-ID') || null;

  if (isDev) {
    console.error(`[${statusCode}] [${requestId || 'no-request-id'}] ${req.method} ${req.originalUrl}`, err.message);
  } else if (statusCode >= 500) {
    console.error(`[500] [${requestId || 'no-request-id'}] ${req.method} ${req.originalUrl}`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message },
    message,
    ...(details ? { details } : {}),
    ...(requestId ? { requestId } : {}),
    ...(isDev && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}
