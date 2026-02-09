import api from './axios';

export const dailyEntryApi = {
  // Get all daily entries with optional filters
  getDailyEntries: async (params = {}) => {
    const response = await api.get('/daily-entries', { params });
    return response.data;
  },

  // Get single entry by ID
  getDailyEntryById: async (id) => {
    const response = await api.get(`/daily-entries/${id}`);
    return response.data;
  },

  // Get entries by date
  getDailyEntriesByDate: async (date, clientId = null) => {
    const params = clientId ? { clientId } : {};
    const response = await api.get(`/daily-entries/date/${date}`, { params });
    return response.data;
  },

  // Create new entry
  createDailyEntry: async (data) => {
    const response = await api.post('/daily-entries', data);
    return response.data;
  },

  // Update entry
  updateDailyEntry: async (id, data) => {
    const response = await api.put(`/daily-entries/${id}`, data);
    return response.data;
  },

  // Delete entry
  deleteDailyEntry: async (id) => {
    const response = await api.delete(`/daily-entries/${id}`);
    return response.data;
  },

  // Get stats summary
  getStats: async (params = {}) => {
    const response = await api.get('/daily-entries/stats/summary', { params });
    return response.data;
  },

  // Get today's stats
  getTodayStats: async () => {
    const response = await api.get('/daily-entries/stats/today');
    return response.data;
  },

  // Get Meta lead data from synced leads collection
  getMetaLeadData: async (clientId, date) => {
    const response = await api.get(`/daily-entries/meta-lead/${clientId}/${date}`);
    return response.data;
  },

  // Get Meta fund data from synced fundentries collection
  getMetaFundData: async (clientId, date) => {
    const response = await api.get(`/daily-entries/meta-fund/${clientId}/${date}`);
    return response.data;
  },

  // Trigger Meta sync for today
  triggerMetaSync: async () => {
    const response = await api.post('/daily-entries/sync-meta');
    return response.data;
  },

  // Get all clients from main API
  getMainApiClients: async () => {
    const response = await api.get('/daily-entries/main-clients');
    return response.data;
  },

  // Get all leads from main API for a specific date
  getMainApiLeadsByDate: async (date) => {
    const response = await api.get(`/daily-entries/main-leads/${date}`);
    return response.data;
  },

  // Get all funds from main API for a specific date
  getMainApiFundsByDate: async (date) => {
    const response = await api.get(`/daily-entries/main-funds/${date}`);
    return response.data;
  },
};

export default dailyEntryApi;
