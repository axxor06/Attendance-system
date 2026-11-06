import api from './client.js';

export const attendanceApi = {
  mark: (payload) => api.post('/attendance/mark', payload),
  sessionRoster: (params) => api.get('/attendance/session-roster', { params }),
  editEntry: (id, payload) => api.patch(`/attendance/${id}`, payload),
  pending: () => api.get('/attendance/pending'),
  history: (params) => api.get('/attendance/history', { params }),
  correctableSessions: (params) => api.get('/attendance/corrections/sessions', { params }),
  correctionRoster: (params) => api.get('/attendance/corrections/roster', { params }),
  saveCorrections: (payload) => api.post('/attendance/corrections', payload),
  correctionHistory: (params) => api.get('/attendance/corrections', { params }),
};
