/**
 * Sends a consistently-shaped success response across the entire API:
 * { success: true, message, data }
 * Keeping this in one place means the frontend can rely on one response
 * contract for every endpoint.
 */
export function sendResponse(res, statusCode, message, data = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export default sendResponse;
