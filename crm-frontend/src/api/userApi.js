import api from './axios';

export const userApi = {
  // Get all users with optional pagination and filters
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Get single user by ID
  getUser: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  // Create new user
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  // Update user
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  // Delete user
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  // Toggle user status (activate/deactivate)
  toggleUserStatus: async (id) => {
    const response = await api.patch(`/users/${id}/toggle-status`);
    return response.data;
  },

  // Change user password (admin)
  changeUserPassword: async (id, newPassword) => {
    const response = await api.patch(`/users/${id}/change-password`, { newPassword });
    return response.data;
  },

  // Update user permissions
  updatePermissions: async (id, permissions) => {
    const response = await api.patch(`/users/${id}/permissions`, { permissions });
    return response.data;
  },

  // Get distinct teams from database
  getTeams: async () => {
    const response = await api.get('/users/teams');
    return response.data;
  },

  // Get distinct roles from database (powers the Role Autocomplete)
  getRoles: async () => {
    const response = await api.get('/users/roles');
    return response.data;
  },

  // Get user statistics
  getUserStats: async () => {
    const response = await api.get('/users/stats');
    return response.data;
  },
};

export default userApi;
