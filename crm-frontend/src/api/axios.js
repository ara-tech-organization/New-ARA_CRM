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
// Only force-logout on 401s that are CLEARLY about the JWT being bad,
// AND only after a short grace window. Network blips, mid-boot backend
// states (the new on-startup migrations need a beat to finish), and
// 401s from non-auth endpoints with a generic message no longer rip
// the user out of the page mid-task. The grace window cancels the
// pending redirect if ANY 200 response lands before it fires — that
// way a single transient 401 surrounded by healthy traffic is treated
// as an outlier instead of a session-killer.
const REDIRECT_GRACE_MS = 800;
let pendingLogoutTimer = null;
const cancelPendingLogout = () => {
  if (pendingLogoutTimer) {
    clearTimeout(pendingLogoutTimer);
    pendingLogoutTimer = null;
  }
};

api.interceptors.response.use(
  (response) => {
    // Any successful response means our session is still good — wipe
    // any pending logout the previous error might have queued.
    cancelPendingLogout();
    return response;
  },
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

      if (!isLoginAttempt && !isAuthEndpoint && isTokenError && !pendingLogoutTimer) {
        pendingLogoutTimer = setTimeout(() => {
          pendingLogoutTimer = null;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.replace('/login');
        }, REDIRECT_GRACE_MS);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
