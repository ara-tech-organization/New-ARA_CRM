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
 * Protect client portal routes — verify JWT with role: 'client'
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
    if (decoded.role !== 'client' || !decoded.clientId) {
      return res.status(403).json({ success: false, message: 'Not a client token' });
    }
    const client = await Client.findById(decoded.clientId).select('clientName portalEnabled google_ads_enabled google_ads_customer_id').lean();
    if (!client || !client.portalEnabled) {
      return res.status(401).json({ success: false, message: 'Portal access disabled' });
    }
    req.clientId = decoded.clientId;
    req.clientData = client;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
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
