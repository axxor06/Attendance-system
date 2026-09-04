const FRIENDLY_BY_CODE = {
  VALIDATION_ERROR: 'Some fields need attention. Please review the highlighted values and try again.',
  INVALID_ID: 'That item could not be found. Please refresh and try again.',
  NOT_FOUND: 'The requested page or record could not be found.',
  FORBIDDEN: 'You do not have permission to access this area.',
  UNAUTHORIZED: 'Your session has ended. Please sign in again.',
  INVALID_TOKEN: 'Your session is no longer valid. Please sign in again.',
  TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  DUPLICATE_RESOURCE: 'That record already exists. Check the details and try again.',
  EMAIL_ALREADY_EXISTS: 'This Gmail address already exists. Please use a different Gmail address or sign in.',
  RATE_LIMITED: 'Too many requests were made. Please wait a moment and try again.',
  STATUS_NOT_FOUND: "We couldn't find that registration request. Check your status reference and try again.",
  STATUS_REFERENCE_INVALID: 'This status reference is invalid or has expired.',
  STATUS_LINK_EXPIRED: 'This status reference has expired. Please contact the administration.',
  NETWORK_ERROR: 'We could not reach the server. Check your connection and try again.',
  PAYLOAD_TOO_LARGE: 'The submitted file or request is too large. Please choose a smaller file or shorten the request.',
  INVALID_PROFILE_IMAGE: 'That profile image could not be accepted. Use a supported image file and try again.',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our side. Please try again shortly.',
};

const MAX_SAFE_MESSAGE_LENGTH = 400;

function cleanServerMessage(value) {
  if (typeof value !== 'string') return '';
  const message = value.trim();
  return message && message.length <= MAX_SAFE_MESSAGE_LENGTH ? message : '';
}

function getResponseData(error) {
  return error?.response?.data || null;
}

function getServerMessage(error) {
  const data = getResponseData(error);
  return cleanServerMessage(data?.error?.message) || cleanServerMessage(data?.message);
}

function formatConflictDetail(detail) {
  if (typeof detail === 'string') return cleanServerMessage(detail);
  if (!detail || typeof detail !== 'object') return '';
  const faculty = cleanServerMessage(detail.facultyName) || 'The selected Faculty member';
  const day = cleanServerMessage(detail.dayOfWeek);
  const dayLabel = day ? `${day[0].toUpperCase()}${day.slice(1)}` : 'the selected day';
  const order = Number.isInteger(Number(detail.order)) ? `Period ${Number(detail.order)}` : 'the selected period';
  const time = cleanServerMessage(detail.startTime) && cleanServerMessage(detail.endTime)
    ? ` (${cleanServerMessage(detail.startTime)}–${cleanServerMessage(detail.endTime)})`
    : '';
  return `${faculty} is already occupied on ${dayLabel}, ${order}${time}. Choose another available Faculty member.`;
}

function getSafeDetails(error) {
  const details = getResponseData(error)?.details;
  if (!Array.isArray(details)) return '';
  return details.map(formatConflictDetail).filter(Boolean).slice(0, 6).join(' ');
}

function isGenericServerMessage(message) {
  return !message || /^(?:something went wrong|internal server error|the request could not be completed|the request could not be completed on the server)/i.test(message.trim());
}

function getActionableServerMessage(error) {
  const serverMessage = getServerMessage(error);
  const detailsMessage = getSafeDetails(error);
  return detailsMessage && isGenericServerMessage(serverMessage) ? detailsMessage : serverMessage || detailsMessage;
}

export function getFriendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const status = error.response?.status;
  const code = error.response?.data?.error?.code || error.response?.data?.code;
  const serverMessage = getActionableServerMessage(error);
  const isNetworkFailure = !error.response && (
    error.code === 'ERR_NETWORK'
    || error.code === 'ECONNABORTED'
    || error.code === 'ECONNREFUSED'
    || error.code === 'ETIMEDOUT'
    || error.code === 'ENETUNREACH'
    || error.message === 'Network Error'
    || Boolean(error.request)
  );
  if (isNetworkFailure) return FRIENDLY_BY_CODE.NETWORK_ERROR;
  // Handle HTTP status before the generic code map. ApiError responses without
  // an explicit code may be serialized as INTERNAL_SERVER_ERROR even when the
  // status is a precise 409/422 conflict or validation response.
  if (status === 401) return serverMessage || FRIENDLY_BY_CODE.UNAUTHORIZED;
  if (status === 403) return serverMessage || FRIENDLY_BY_CODE.FORBIDDEN;
  if (status === 404) return serverMessage || FRIENDLY_BY_CODE.NOT_FOUND;
  if (status === 410 || code === 'STATUS_LINK_EXPIRED') return serverMessage || FRIENDLY_BY_CODE.STATUS_LINK_EXPIRED;
  if (status === 413) return serverMessage || FRIENDLY_BY_CODE.PAYLOAD_TOO_LARGE;
  if (status === 422 || status === 400) return serverMessage || FRIENDLY_BY_CODE[code] || FRIENDLY_BY_CODE.VALIDATION_ERROR;
  if (status === 409) return serverMessage || FRIENDLY_BY_CODE[code] || FRIENDLY_BY_CODE.DUPLICATE_RESOURCE;
  if (status === 429) return serverMessage || FRIENDLY_BY_CODE.RATE_LIMITED;
  if (FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code];
  return serverMessage || fallback;
}

export function getErrorPageState(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.error?.code;
  const isNetworkFailure = !error?.response && Boolean(error) && (
    error.code === 'ERR_NETWORK'
    || error.code === 'ECONNABORTED'
    || error.code === 'ECONNREFUSED'
    || error.code === 'ENETUNREACH'
    || error.message === 'Network Error'
    || Boolean(error.request)
  );
  if (isNetworkFailure) return { kind: 'network', title: 'Connection interrupted', message: FRIENDLY_BY_CODE.NETWORK_ERROR };
  if (status === 401 || code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED') return { kind: 'unauthorized', title: 'Sign-in required', message: getFriendlyError(error, FRIENDLY_BY_CODE.UNAUTHORIZED) };
  if (status === 403 || code === 'FORBIDDEN') return { kind: 'forbidden', title: 'Access restricted', message: getFriendlyError(error, FRIENDLY_BY_CODE.FORBIDDEN) };
  if (status === 404 || code === 'NOT_FOUND') return { kind: 'not-found', title: 'Page not found', message: getFriendlyError(error, FRIENDLY_BY_CODE.NOT_FOUND) };
  if (status === 410 || code === 'STATUS_LINK_EXPIRED') return { kind: 'validation', title: 'Status reference expired', message: getFriendlyError(error, FRIENDLY_BY_CODE.STATUS_LINK_EXPIRED) };
  if (status === 422 || status === 400 || code === 'VALIDATION_ERROR') return { kind: 'validation', title: 'Please check the details', message: getFriendlyError(error, FRIENDLY_BY_CODE.VALIDATION_ERROR) };
  if (status === 409) return { kind: 'conflict', title: 'Action needs attention', message: getFriendlyError(error, FRIENDLY_BY_CODE.DUPLICATE_RESOURCE) };
  return { kind: 'server', title: 'Something went wrong', message: getFriendlyError(error, FRIENDLY_BY_CODE.INTERNAL_SERVER_ERROR) };
}
