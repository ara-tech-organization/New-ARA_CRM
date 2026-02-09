import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors - but don't auto-logout on every 401
    // Only logout if it's a token validation error (not network/server issues)
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      const errorMessage = error.response?.data?.message?.toLowerCase() || '';

      // Only clear auth and redirect if it's specifically a token/auth issue
      // Not for general API errors or when backend is unreachable
      const isTokenError = errorMessage.includes('token') ||
                          errorMessage.includes('unauthorized') ||
                          errorMessage.includes('not authorized') ||
                          errorMessage.includes('jwt') ||
                          errorMessage.includes('expired');

      if (!isAuthEndpoint && isTokenError) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
