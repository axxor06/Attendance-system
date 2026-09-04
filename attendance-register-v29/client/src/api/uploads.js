import api from './client.js';

function createPhotoForm(file) {
  const form = new FormData();
  form.append('photo', file);
  return form;
}

export const uploadApi = {
  registrationPhoto: (file, config = {}) => api.post('/uploads/registration-photo', createPhotoForm(file), { ...config, headers: { 'Content-Type': 'multipart/form-data', ...(config.headers || {}) } }),
  profilePhoto: (file, config = {}) => api.post('/uploads/profile-photo', createPhotoForm(file), { ...config, headers: { 'Content-Type': 'multipart/form-data', ...(config.headers || {}) } }),
};
