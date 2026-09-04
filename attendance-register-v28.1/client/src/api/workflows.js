import api from './client.js';

export const timetableApi = {
  list: (params) => api.get('/timetables', { params }),
  get: (classId, config = {}) => api.get(`/timetables/${classId}`, config),
  save: (classId, payload) => api.put(`/timetables/${classId}`, payload),
  availability: (params, config = {}) => api.get('/timetables/availability', { ...config, params }),
};

export const leaveApi = {
  list: (params) => api.get('/leave-requests', { params }),
  create: (payload) => api.post('/leave-requests', payload),
  decide: (id, payload) => api.patch(`/leave-requests/${id}/decision`, payload),
};

export const assignmentRequestApi = {
  list: (params) => api.get('/assignment-requests', { params }),
  create: (payload) => api.post('/assignment-requests', payload),
  decide: (id, payload) => api.patch(`/assignment-requests/${id}/decision`, payload),
};
