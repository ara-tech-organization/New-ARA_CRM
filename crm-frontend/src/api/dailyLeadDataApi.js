import api from './axios';

export const dailyLeadDataApi = {
  // Get all daily lead data with optional filters
  getDailyLeadData: async (params = {}) => {
    const response = await api.get('/daily-lead-data', { params });
    return response.data;
  },

  // Get single entry by ID
  getDailyLeadDataById: async (id) => {
    const response = await api.get(`/daily-lead-data/${id}`);
    return response.data;
  },

  // Get entries by date
  getDailyLeadDataByDate: async (date, clientId = null) => {
    const params = clientId ? { clientId } : {};
    const response = await api.get(`/daily-lead-data/date/${date}`, { params });
    return response.data;
  },

  // Create new entry
  createDailyLeadData: async (data) => {
    const response = await api.post('/daily-lead-data', data);
    return response.data;
  },

  // Update entry
  updateDailyLeadData: async (id, data) => {
    const response = await api.put(`/daily-lead-data/${id}`, data);
    return response.data;
  },

  // Delete entry
  deleteDailyLeadData: async (id) => {
    const response = await api.delete(`/daily-lead-data/${id}`);
    return response.data;
  },

  // Get stats summary
  getStats: async (params = {}) => {
    const response = await api.get('/daily-lead-data/stats/summary', { params });
    return response.data;
  },

  // Get campaign comparison
  getCampaignComparison: async (params = {}) => {
    const response = await api.get('/daily-lead-data/stats/campaign-comparison', { params });
    return response.data;
  },
};

export default dailyLeadDataApi;
