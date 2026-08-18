import api, { refreshAccessToken } from './client.js';

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  verifyEmail: (payload) => api.post('/auth/verify-email', payload),
  resendOtp: (payload) => api.post('/auth/resend-otp', payload),
  login: ({ identifier, password }) => api.post('/auth/login', { identifier, password }),
  refresh: refreshAccessToken,
  logout: () => api.post('/auth/logout'),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  verifyResetOtp: (payload) => api.post('/auth/verify-reset-otp', payload),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  getMe: () => api.get('/auth/me'),
  updateMe: (payload) => api.patch('/auth/me', payload),
};
