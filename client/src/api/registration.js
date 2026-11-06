import api from './client.js';

export const registrationRequestApi = {
  submit: (payload) => api.post('/registration-requests', payload),
  checkStatus: ({ code, requestId, statusToken }) => api.get('/registration-requests/status', { params: code ? { code } : { requestId, statusToken } }),
  // HOD only
  list: (params = {}) => api.get('/registration-requests', { params: typeof params === 'string' ? { status: params } : params }),
  get: (id) => api.get(`/registration-requests/${id}`),
  summary: () => api.get('/registration-requests/summary'),
  approve: (id, identifier) => api.post(`/registration-requests/${id}/approve`, { identifier }),
  reject: (id, reason) => api.post(`/registration-requests/${id}/reject`, { reason }),
};

export const qrApi = {
  generate: (payload) => api.post('/qr/generate', payload),
  scan: (code) => api.post('/qr/scan', { code }),
  stats: (params) => api.get('/qr/stats', { params }),
};
