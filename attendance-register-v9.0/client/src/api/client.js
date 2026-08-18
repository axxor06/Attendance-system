import axios from 'axios';
import { isSingleFlightRunning, runSingleFlight } from './singleFlight.js';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
});

let accessToken = null;
let authEpoch = 0;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

/** Invalidate stale request retries after logout or a terminal auth failure. */
export function invalidateAuthSession() {
  authEpoch += 1;
  accessToken = null;
}

export function getAuthEpoch() {
  return authEpoch;
}

/**
 * Refresh access is a single-flight operation. Every caller during an active
 * rotation receives the same promise, which is essential because refresh
 * tokens are rotated and the previous token is intentionally invalidated.
 *
 * This uses the bare Axios transport rather than the authenticated `api`
 * instance so the refresh request cannot recursively enter the 401 interceptor.
 */
export function refreshAccessToken() {
  const refreshEpoch = authEpoch;
  return runSingleFlight(async () => {
    const { data } = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
    if (refreshEpoch !== authEpoch) {
      throw new Error('Authentication session changed while refreshing.');
    }
    const session = data?.data;
    const newToken = session?.accessToken;
    if (!newToken) {
      throw new Error('Refresh response did not include an access token.');
    }
    setAccessToken(newToken);
    return session;
  });
}

export function hasRefreshInFlight() {
  return isSingleFlightRunning();
}

api.interceptors.request.use((config) => {
  if (config._authEpoch === undefined) config._authEpoch = authEpoch;
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (
      response?.status !== 401
      || !config
      || config._retry
      || config.url?.includes('/auth/refresh')
      || config.url?.includes('/auth/login')
      || config.url?.includes('/auth/logout')
      || config._authEpoch !== authEpoch
    ) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      const session = await refreshAccessToken();
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${session.accessToken}`;
      return api(config);
    } catch (refreshError) {
      invalidateAuthSession();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
