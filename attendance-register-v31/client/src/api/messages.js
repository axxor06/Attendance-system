import api from './client';

export const messagesApi = {
  recipients: (params = {}) => api.get('/messages/recipients', { params }),
  profile: (userId) => api.get(`/messages/profiles/${userId}`),
  conversations: (params = {}) => api.get('/messages/conversations', { params }),
  createConversation: (recipientId) => api.post('/messages/conversations', { recipientId }),
  messages: (conversationId, params = {}) => api.get(`/messages/conversations/${conversationId}/messages`, { params }),
  send: (conversationId, payload) => api.post(`/messages/conversations/${conversationId}/messages`, payload),
  edit: (conversationId, messageId, payload) => api.patch(`/messages/conversations/${conversationId}/messages/${messageId}`, payload),
  remove: (conversationId, messageId, mode) => api.delete(`/messages/conversations/${conversationId}/messages/${messageId}`, { data: { mode } }),
  markRead: (conversationId) => api.patch(`/messages/conversations/${conversationId}/read`),
};
