import api from './client.js';

export const subjectApi = {
  list: (params) => api.get('/subjects', { params }),
  mySubjects: () => api.get('/subjects/my-subjects'),
  getById: (id) => api.get(`/subjects/${id}`),
  create: (payload) => api.post('/subjects', payload),
  update: (id, payload) => api.patch(`/subjects/${id}`, payload),
  remove: (id) => api.delete(`/subjects/${id}`),
};

export const periodApi = {
  listActive: () => api.get('/periods'),
  getByDay: (day) => api.get(`/periods/${day}`),
  upsert: (payload) => api.post('/periods', payload),
  deactivate: (id) => api.patch(`/periods/${id}/deactivate`),
};
