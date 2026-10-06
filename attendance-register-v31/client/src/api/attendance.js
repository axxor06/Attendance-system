import api from './client.js';

export const attendanceApi = {
  mark: (payload) => api.post('/attendance/mark', payload),
  sessionRoster: (params) => api.get('/attendance/session-roster', { params }),
  editEntry: (id, payload) => api.patch(`/attendance/${id}`, payload),
  pending: () => api.get('/attendance/pending'),
  history: (params) => api.get('/attendance/history', { params }),
};
