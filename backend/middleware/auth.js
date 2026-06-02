import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Client from '../models/Client.js';
import { asyncHandler } from './errorHandler.js';

// ============================================
// User Cache for Authentication Performance
// ============================================
const userCache = new Map();
const USER_CACHE_TTL = 60 * 1000; // 1 minute cache TTL

const getCachedUser = (userId) => {
  const cached = userCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < USER_CACHE_TTL) {
    return cached.user;
  }
  userCache.delete(userId);
  return null;
};

const setCachedUser = (userId, user) => {
  userCache.set(userId, { user, timestamp: Date.now() });
};

// Clear user from cache (call when user is updated/deactivated)
export const clearUserCache = (userId = null) => {
  if (userId) {
    userCache.delete(userId);
  } else {
    userCache.clear();
  }
};

// Periodically clean expired cache entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [userId, cached] of userCache.entries()) {
    if (now - cached.timestamp > USER_CACHE_TTL) {
      userCache.delete(userId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Protect routes - Verify JWT token (with caching)
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in Authorization header or cookies
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check cache first
    let user = getCachedUser(decoded.id);

    if (!user) {
      // Get user from database using lean() for better performance
      user = await User.findById(decoded.id).select('-password').lean();

      if (user) {
        setCachedUser(decoded.id, user);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
});

/**
 * Protect client portal routes — verify JWT for an admin/telecaller
 * ClientPortalUser. Falls back to accepting legacy `role: 'client'`
 * tokens (issued before per-user RBAC) so existing sessions don't break
 * mid-rollout — those are treated as `admin` for backwards compat.
 */
export const protectClient = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.clientId) {
      return res.status(403).json({ success: false, message: 'Not a client token' });
    }

    const client = await Client.findById(decoded.clientId)
      .select('clientName portalEnabled google_ads_enabled google_ads_customer_id meta_enabled')
      .lean();
    if (!client || !client.portalEnabled) {
      return res.status(401).json({ success: false, message: 'Portal access disabled' });
    }

    req.clientId = decoded.clientId;
    req.clientData = client;

    // Load the portal user when the JWT carries a userId. Legacy tokens
    // (role: 'client', no userId) are grandfathered as admin.
    if (decoded.userId) {
      const ClientPortalUser = (await import('../models/ClientPortalUser.js')).default;
      const portalUser = await ClientPortalUser.findById(decoded.userId).lean();
      if (!portalUser || !portalUser.isActive) {
        return res.status(401).json({ success: false, message: 'Portal user not found or deactivated' });
      }
      if (String(portalUser.clientId) !== String(decoded.clientId)) {
        return res.status(403).json({ success: false, message: 'Token does not match portal user' });
      }
      req.portalUser = portalUser;
      req.role = portalUser.role;
    } else {
      // Legacy token without a userId payload — issued before per-user
      // RBAC existed. Previously these got `admin` automatically, which
      // was a silent privilege escalation: anyone holding an old portal
      // JWT had full portal-admin power forever. Now we degrade to
      // `telecaller` (least privilege) so the session still works for
      // safe reads (Meta leads handling), but admin-only endpoints
      // (user CRUD, etc.) reject and force a fresh login.
      req.portalUser = null;
      req.role = 'telecaller';
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
});

/**
 * Restrict a client portal route to specific roles. Use after `protectClient`.
 *   router.get('/users', protectClient, requireClientPortalRole('admin'), handler);
 */
export const requireClientPortalRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.role)) {
    return res.status(403).json({
      success: false,
      message: `This action requires one of: ${roles.join(', ')}`,
    });
  }
  next();
};

/**
 * Combined auth for routes used by BOTH the admin app and the client
 * portal (the /api/meta tree being the main example). Accepts either
 * an agency-user JWT (decoded.id → req.user) or a portal-user JWT
 * (decoded.clientId → req.clientData, req.clientId, req.role).
 *
 * Downstream handlers can distinguish via:
 *   req.user        → admin/agency call
 *   req.clientId    → client-portal call
 * `loadClientOr404` (in metaController) reads these to verify tenant
 * ownership and reject IDOR attempts.
 */
export const protectAdminOrClient = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }

  // ── Portal token: `clientId` payload ────────────────────────
  if (decoded.clientId) {
    const client = await Client.findById(decoded.clientId)
      .select('clientName portalEnabled google_ads_enabled google_ads_customer_id meta_enabled')
      .lean();
    if (!client || !client.portalEnabled) {
      return res.status(401).json({ success: false, message: 'Portal access disabled' });
    }
    req.clientId = decoded.clientId;
    req.clientData = client;
    if (decoded.userId) {
      const ClientPortalUser = (await import('../models/ClientPortalUser.js')).default;
      const portalUser = await ClientPortalUser.findById(decoded.userId).lean();
      if (!portalUser || !portalUser.isActive) {
        return res.status(401).json({ success: false, message: 'Portal user not found or deactivated' });
      }
      if (String(portalUser.clientId) !== String(decoded.clientId)) {
        return res.status(403).json({ success: false, message: 'Token does not match portal user' });
      }
      req.portalUser = portalUser;
      req.role = portalUser.role;
    } else {
      req.portalUser = null;
      req.role = 'admin';
    }
    return next();
  }

  // ── Agency token: `id` payload ──────────────────────────────
  if (decoded.id) {
    let user = getCachedUser(decoded.id);
    if (!user) {
      user = await User.findById(decoded.id).select('-password').lean();
      if (user) setCachedUser(decoded.id, user);
    }
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'User account is deactivated' });
    }
    req.user = user;
    return next();
  }

  return res.status(401).json({ success: false, message: 'Unrecognised token payload' });
});

/**
 * Grant access to specific roles
 * @param {...string} roles - Allowed roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};
