import ApiError from '../utils/ApiError.js';

/**
 * Reject fields that are not part of an endpoint's explicit contract.
 * This keeps browser payloads and server mutations end-to-end aligned and
 * prevents newly added model fields from becoming implicitly writable.
 */
export function rejectUnknownBodyFields(allowedFields) {
  const allowed = new Set(allowedFields);
  return (req, _res, next) => {
    const body = req.body;
    if (body === undefined || body === null) return next();
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw ApiError.badRequest('Request body must be a JSON object.');
    }
    const unknown = Object.keys(body).filter((field) => !allowed.has(field));
    if (unknown.length) {
      throw ApiError.badRequest(`Unsupported request field: ${unknown[0]}.`);
    }
    next();
  };
}
