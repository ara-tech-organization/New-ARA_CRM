import api from './axios';

export const contentEntryApi = {
  getContentEntries: async (params = {}) => {
    const response = await api.get('/content-entries', { params });
    return response.data;
  },

  createContentEntry: async (data) => {
    const response = await api.post('/content-entries', data);
    return response.data;
  },

  updateContentEntry: async (id, data) => {
    const response = await api.put(`/content-entries/${id}`, data);
    return response.data;
  },

  deleteContentEntry: async (id) => {
    const response = await api.delete(`/content-entries/${id}`);
    return response.data;
  },

  getContentEntriesByMonth: async (year, month) => {
    const response = await api.get(`/content-entries/calendar/${year}/${month}`);
    return response.data;
  },

  getSMMUsers: async () => {
    const response = await api.get('/content-entries/smm-users');
    return response.data;
  },
};

export default contentEntryApi;
