function safeMessage(statusCode, message) {
  if (statusCode >= 500) return 'Something went wrong on the server. Please try again later.';
  return message || 'The request could not be completed.';
}

export function notFoundHandler(req, res, next) {
  const err = new Error('Requested resource was not found.');
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  next(err);
}

export function errorHandler(err, req, res, _next) {
  let statusCode = Number(err.statusCode) || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;
  let code = err.code && typeof err.code === 'string' && err.code.length < 80 ? err.code : null;

  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((item) => item.message).filter(Boolean);
    message = 'Please check the highlighted fields.';
  }

  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Image must be 3 MB or smaller.';
    details = null;
  }

  if (err.code === 'INVALID_PROFILE_IMAGE') {
    statusCode = 422;
    code = 'INVALID_PROFILE_IMAGE';
    details = null;
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'The supplied identifier is invalid.';
    details = null;
  }

  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `A record with that ${field} already exists.` : 'That record already exists.';
    details = null;
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Your session is no longer valid. Please sign in again.';
    details = null;
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Your session expired. Please sign in again.';
    details = null;
  }

  if (statusCode < 400 || statusCode > 599) statusCode = 500;
  if (!code) {
    code = ({
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
    })[statusCode] || 'INTERNAL_SERVER_ERROR';
  }
  const requestId = req.id || req.get('X-Request-ID') || null;
  const publicMessage = safeMessage(statusCode, message);

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${statusCode}] [${requestId || 'no-request-id'}] ${req.method} ${req.originalUrl}`, err.message);
  } else if (statusCode >= 500) {
    console.error(`[${statusCode}] [${requestId || 'no-request-id'}] ${req.method} ${req.originalUrl}`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message: publicMessage },
    message: publicMessage,
    ...(Array.isArray(details) && details.length ? { details } : {}),
    ...(requestId ? { requestId } : {}),
  });
}
