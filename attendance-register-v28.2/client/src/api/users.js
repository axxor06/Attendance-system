import api from './client.js';

export const userApi = {
  list: (params, config = {}) => api.get('/users', { ...config, params }),
  assignedStudents: (params, config = {}) => api.get('/users/assigned-students', { ...config, params }),
  getById: (id) => api.get(`/users/${id}`),
  getSummary: (id) => api.get(`/users/${id}/summary`),
  create: (payload) => api.post('/users', payload),
  update: (id, payload) => api.patch(`/users/${id}`, payload),
  remove: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, payload) => api.post(`/users/${id}/reset-password`, payload || {}),
  resetDevice: (id) => api.post(`/users/${id}/reset-device`),
};
