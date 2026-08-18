import api from './client.js';

export const departmentApi = {
  list: (params) => api.get('/departments', { params }),
  getById: (id) => api.get(`/departments/${id}`),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.patch(`/departments/${id}`, payload),
  remove: (id) => api.delete(`/departments/${id}`),
};

export const semesterApi = {
  list: () => api.get('/semesters'),
  getById: (id) => api.get(`/semesters/${id}`),
  create: (payload) => api.post('/semesters', payload),
  update: (id, payload) => api.patch(`/semesters/${id}`, payload),
  remove: (id) => api.delete(`/semesters/${id}`),
};

export const classApi = {
  list: (params) => api.get('/classes', { params }),
  publicOptions: () => api.get('/classes/public-options'),
  getById: (id) => api.get(`/classes/${id}`),
  create: (payload) => api.post('/classes', payload),
  update: (id, payload) => api.patch(`/classes/${id}`, payload),
  remove: (id) => api.delete(`/classes/${id}`),
};
