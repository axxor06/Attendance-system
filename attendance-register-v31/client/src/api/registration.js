import api from './client.js';

export const registrationRequestApi = {
  submit: (payload) => api.post('/registration-requests', payload),
  checkStatus: ({ code, requestId, statusToken }) => api.get('/registration-requests/status', { params: code ? { code } : { requestId, statusToken } }),
  // HOD only
  list: (status = 'pending') => api.get('/registration-requests', { params: { status } }),
  approve: (id, identifier) => api.post(`/registration-requests/${id}/approve`, { identifier }),
  reject: (id, reason) => api.post(`/registration-requests/${id}/reject`, { reason }),
};

export const qrApi = {
  generate: (payload) => api.post('/qr/generate', payload),
  scan: (token) => api.post('/qr/scan', { token }),
  stats: (params) => api.get('/qr/stats', { params }),
};
