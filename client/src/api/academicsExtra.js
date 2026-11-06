import api from './client.js';

export const subjectApi = {
  list: (params, config = {}) => api.get('/subjects', { ...config, params }),
  mySubjects: (params = {}, config = {}) => api.get('/subjects/my-subjects', { ...config, params }),
  getById: (id) => api.get(`/subjects/${id}`),
  create: (payload) => api.post('/subjects', payload),
  update: (id, payload) => api.patch(`/subjects/${id}`, payload),
  remove: (id) => api.delete(`/subjects/${id}`),
};

export const periodApi = {
  listActive: () => api.get('/periods'),
  getByDay: (day, params, config = {}) => api.get(`/periods/${day}`, { ...config, params }),
  upsert: (payload) => api.post('/periods', payload),
  deactivate: (id) => api.patch(`/periods/${id}/deactivate`),
};
