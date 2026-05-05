import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api';

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

// Response interceptor to handle 401 errors.
//
// Only force-logout on 401s that are CLEARLY about the JWT being bad.
// Network blips, transient backend errors, and 401s from non-auth
// endpoints with a generic message are now ignored — they bubble back
// to the calling code so individual pages can show a friendly retry
// prompt instead of yanking the user to /login.
//
// Specifically, the older logic kicked the user on ANY 401 from
// `/auth/me` regardless of the message body. That meant a single
// transient 401 (e.g., the backend was mid-boot and hadn't finished
// loading the JWT secret, or a /auth/me call raced one of the on-boot
// migrations) was enough to log everyone out. The new logic requires
// an explicit token-error message even on /auth/me.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      const errorMessage = (error.response?.data?.message || error.response?.data?.error || '').toLowerCase();

      const isTokenError =
        errorMessage.includes('token') ||
        errorMessage.includes('jwt') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('not authorized') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('user not found') ||
        errorMessage.includes('account is deactivated') ||
        errorMessage.includes('login again');

      // /auth/login itself returns 401 on bad creds — never redirect on those.
      const isLoginAttempt = error.config?.url?.includes('/auth/login');

      if (!isLoginAttempt && !isAuthEndpoint && isTokenError) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
