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
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      const errorMessage = error.response?.data?.message?.toLowerCase() || '';

      const isTokenError = errorMessage.includes('token') ||
                          errorMessage.includes('unauthorized') ||
                          errorMessage.includes('not authorized') ||
                          errorMessage.includes('jwt') ||
                          errorMessage.includes('expired') ||
                          errorMessage.includes('user not found') ||
                          errorMessage.includes('login again');

      const isMeEndpoint = error.config?.url?.includes('/auth/me');

      if ((!isAuthEndpoint && isTokenError) || isMeEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
