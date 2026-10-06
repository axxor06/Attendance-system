import api from './client.js';

export const dashboardApi = {
  hod: () => api.get('/dashboard/hod'),
  faculty: () => api.get('/dashboard/faculty'),
  student: () => api.get('/dashboard/student'),
};

export const notificationApi = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`),
};

export const searchApi = {
  global: (q) => api.get('/search', { params: { q } }),
};

async function downloadFile(url, fallbackFilename) {
  const response = await api.get(url, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const match = /filename="(.+)"/.exec(disposition);
  const filename = match ? match[1] : fallbackFilename;

  const blobUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export const reportApi = {
  downloadSubjectReport: (subjectId, format = 'pdf') =>
    downloadFile(`/reports/subject/${subjectId}?format=${format}`, `subject-report.${format === 'excel' ? 'xlsx' : 'pdf'}`),
  downloadStudentReport: (studentId, format = 'pdf') =>
    downloadFile(`/reports/student/${studentId || ''}?format=${format}`, `attendance-report.${format === 'excel' ? 'xlsx' : 'pdf'}`),
  downloadClassMonthlyReport: (classId, { format = 'pdf', year, month } = {}) =>
    downloadFile(
      `/reports/class/${classId}/monthly?format=${format}${year ? `&year=${year}` : ''}${month ? `&month=${month}` : ''}`,
      `monthly-report.${format === 'excel' ? 'xlsx' : 'pdf'}`
    ),
};
