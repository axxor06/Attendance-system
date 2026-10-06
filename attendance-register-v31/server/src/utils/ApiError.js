/**
 * Standard application error with an HTTP status code attached.
 * Thrown anywhere in services/controllers and caught by the global
 * error handler middleware, which uses `.statusCode` to set the response.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isApiError = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden: insufficient permissions') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static gone(message = 'This resource is no longer available') {
    return new ApiError(410, message);
  }

  static conflict(message = 'Conflict with existing resource', details = null) {
    return new ApiError(409, message, details);
  }

  static emailAlreadyExists() {
    const error = new ApiError(409, 'This Gmail address already exists. Please use a different Gmail address or sign in.');
    error.code = 'EMAIL_ALREADY_EXISTS';
    return error;
  }

  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new ApiError(429, message);
  }

  static payloadTooLarge(message = 'The requested export is too large.') {
    return new ApiError(413, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}

export default ApiError;
