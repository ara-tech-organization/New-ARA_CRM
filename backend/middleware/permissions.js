import { asyncHandler } from './errorHandler.js';

/**
 * Map API permissions to corresponding page permissions
 * This allows users with page-level access to use the API
 */
const API_TO_PAGE_PERMISSIONS = {
  // Entry permissions -> daily-entry, daily-lead-data pages
  'entry:create': ['daily-entry', 'daily-lead-data'],
  'entry:read': ['daily-entry', 'daily-lead-data', 'dashboard'],
  'entry:update': ['daily-entry', 'daily-lead-data'],
  'entry:delete': ['daily-entry', 'daily-lead-data'],
  // Lead permissions -> leads, daily-lead-data pages
  'lead:create': ['leads', 'daily-lead-data'],
  'lead:read': ['leads', 'daily-lead-data', 'dashboard'],
  'lead:update': ['leads', 'daily-lead-data'],
  'lead:delete': ['leads'],
  // Client permissions -> clients page
  'client:create': ['clients'],
  'client:read': ['clients', 'dashboard', 'daily-entry', 'daily-lead-data'],
  'client:update': ['clients'],
  'client:delete': ['clients'],
  // Fund permissions -> fund-entry page
  'fund:create': ['fund-entry'],
  'fund:read': ['fund-entry', 'dashboard'],
  'fund:update': ['fund-entry'],
  'fund:delete': ['fund-entry'],
  // Vault permissions -> client-vault page
  'vault:read': ['client-vault'],
  'vault:update': ['client-vault'],
  // Report permissions -> reports page
  'report:view': ['reports', 'dashboard'],
  'report:export': ['reports'],
  // Settings permissions -> settings page
  'settings:update': ['settings'],
  // User permissions -> access-management page
  'user:create': ['access-management'],
  'user:read': ['access-management'],
  'user:update': ['access-management'],
  'user:delete': ['access-management'],
};

/**
 * Check if user has specific permission
 * @param {string} permission - Required permission
 */
export const checkPermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    // Superadmin and Admin have all permissions
    if (req.user.role === 'superadmin' || req.user.role === 'admin') {
      return next();
    }

    // Check if user has the required API permission
    if (req.user.permissions.includes(permission)) {
      return next();
    }

    // Check if user has a page permission that grants API access
    const allowedPages = API_TO_PAGE_PERMISSIONS[permission] || [];
    const hasPagePermission = allowedPages.some(page =>
      req.user.permissions.includes(page)
    );

    if (hasPagePermission) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Required permission: ${permission}`,
    });
  });
};

/**
 * Check if user has specific role
 * @param {...string} roles - Required roles
 */
export const checkRole = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  });
};

/**
 * Common permissions list
 */
export const PERMISSIONS = {
  // User management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // Lead management
  LEAD_CREATE: 'lead:create',
  LEAD_READ: 'lead:read',
  LEAD_UPDATE: 'lead:update',
  LEAD_DELETE: 'lead:delete',

  // Client management
  CLIENT_CREATE: 'client:create',
  CLIENT_READ: 'client:read',
  CLIENT_UPDATE: 'client:update',
  CLIENT_DELETE: 'client:delete',

  // Financial management
  FUND_CREATE: 'fund:create',
  FUND_READ: 'fund:read',
  FUND_UPDATE: 'fund:update',
  FUND_DELETE: 'fund:delete',

  // Daily entry management
  ENTRY_CREATE: 'entry:create',
  ENTRY_READ: 'entry:read',
  ENTRY_UPDATE: 'entry:update',
  ENTRY_DELETE: 'entry:delete',

  // Client vault access
  VAULT_READ: 'vault:read',
  VAULT_UPDATE: 'vault:update',

  // Reports
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  // Settings
  SETTINGS_UPDATE: 'settings:update',
};

/**
 * Default permissions by role
 */
export const DEFAULT_PERMISSIONS = {
  superadmin: Object.values(PERMISSIONS),
  admin: Object.values(PERMISSIONS), // Admin has full access
  SMM: [
    // Social Media Manager permissions
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.FUND_READ,
    PERMISSIONS.ENTRY_CREATE,
    PERMISSIONS.ENTRY_READ,
    PERMISSIONS.ENTRY_UPDATE,
    PERMISSIONS.REPORT_VIEW,
  ],
  PMM: [
    // Performance Marketing Manager permissions
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.CLIENT_CREATE,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.FUND_CREATE,
    PERMISSIONS.FUND_READ,
    PERMISSIONS.FUND_UPDATE,
    PERMISSIONS.ENTRY_CREATE,
    PERMISSIONS.ENTRY_READ,
    PERMISSIONS.ENTRY_UPDATE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
  ],
  // Legacy role - keep for backwards compatibility
  staff: [
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.FUND_READ,
    PERMISSIONS.ENTRY_READ,
    PERMISSIONS.REPORT_VIEW,
  ],
};
