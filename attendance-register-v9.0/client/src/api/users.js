import api from './client.js';

export const userApi = {
  list: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (payload) => api.post('/users', payload),
  update: (id, payload) => api.patch(`/users/${id}`, payload),
  remove: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, payload) => api.post(`/users/${id}/reset-password`, payload || {}),
};
