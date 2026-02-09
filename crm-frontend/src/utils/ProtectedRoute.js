import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

// Map routes to permission IDs
const routePermissions = {
  '/dashboard': 'dashboard',
  '/daily-entry': 'daily-entry',
  '/daily-lead-data': 'daily-lead-data',
  '/clients': 'clients',
  '/leads': 'leads',
  '/client-vault': 'client-vault',
  '/fund-entry': 'fund-entry',
  '/reports': 'reports',
  '/settings': 'settings',
  '/access-management': 'access-management',
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const location = useLocation();

  // Also check localStorage as a fallback for initial render
  const hasToken = localStorage.getItem('token');
  const hasUser = localStorage.getItem('user');
  const storedUser = hasUser ? JSON.parse(hasUser) : null;

  // Get the current user (from Redux or localStorage)
  const currentUser = user || storedUser;

  // Allow access if Redux state is authenticated OR if localStorage has valid credentials
  if (!isAuthenticated && !(hasToken && hasUser)) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has permission for this route
  const currentPath = location.pathname;
  const requiredPermission = routePermissions[currentPath];

  // If route requires permission and user is not admin/superadmin
  if (requiredPermission && currentUser) {
    const isAdmin = currentUser.role === 'admin';
    const isSuperAdmin = currentUser.role === 'superadmin';
    const hasFullAccess = isAdmin || isSuperAdmin;

    // Admin and superadmin have full access
    if (!hasFullAccess) {
      // Check if user has the required permission
      const hasPermission = currentUser.permissions?.includes(requiredPermission);

      if (!hasPermission) {
        // Redirect to dashboard or first permitted page
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
