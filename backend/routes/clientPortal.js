import express from 'express';
import mongoose from 'mongoose';
import { protectClient, requireClientPortalRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Client from '../models/Client.js';
import ClientPortalUser from '../models/ClientPortalUser.js';

const router = express.Router();

/**
 * @desc    Get Google Ads analytics for the authenticated client.
 *          Meta data is fetched directly by the frontend against
 *          /api/meta/client/:id/analytics — an earlier attempt to
 *          proxy both through here was unreliable on Azure (internal
 *          self-calls to http://localhost:${PORT} timed out).
 * @route   GET /api/client-portal/analytics
 * @access  Private (client portal)
 *
 * Never 400s when Google is missing — returns an empty shell so the
 * client portal still loads for Meta-only clients.
 */
router.get('/analytics', protectClient, asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  const clientId = req.clientId;

  const client = await Client.findById(clientId).lean();
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const googleEnabled = !!(client.google_ads_enabled && client.google_ads_customer_id);
  const metaEnabled = !!(client.meta_enabled && client.meta_ad_account_id);

  const emptyShell = () => ({
    client: {
      _id: client._id,
      clientName: client.clientName,
      google_ads_enabled: googleEnabled,
      google_ads_customer_id: client.google_ads_customer_id || '',
    },
    summary: {},
    campaignMetrics: [],
    keywords: [],
    dailyMetrics: [],
  });

  let response = emptyShell();
  let googleError = null;

  if (googleEnabled) {
    const axios = (await import('axios')).default;
    const baseUrl = process.env.MAIN_API_URL || `http://localhost:${process.env.PORT || 5000}`;
    try {
      const r = await axios.get(`${baseUrl}/api/analytics/client/${clientId}`, {
        params: { start_date, end_date },
        headers: { Authorization: req.headers.authorization },
        timeout: 15000,
      });
      response = r.data;
    } catch (err) {
      googleError = err.response?.data?.error || err.message || 'Google fetch failed';
    }
  }

  response.integrations = {
    google_enabled: googleEnabled,
    meta_enabled: metaEnabled,
  };
  if (googleError) response.google_error = googleError;

  res.json(response);
}));

// ─────────────────────────────────────────────────────────────────────
// User management — only `admin` portal users can list/add/edit/delete
// other users for their own client. The clientId comes from the JWT, so
// even if an admin tries to forge another client's ID in a request, the
// query is always scoped to req.clientId.
// ─────────────────────────────────────────────────────────────────────

const sanitize = (u) => ({
  _id: u._id,
  name: u.name,
  username: u.username,
  email: u.email || '',
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

// Same allowed character class as the model's regex — kept here too so we
// can reject bad input with a friendly message before the validator runs.
const USERNAME_RE = /^[a-z0-9._-]{3,60}$/;

router.get(
  '/users',
  protectClient,
  requireClientPortalRole('admin'),
  asyncHandler(async (req, res) => {
    const users = await ClientPortalUser.find({ clientId: req.clientId })
      .sort({ role: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, users: users.map(sanitize) });
  })
);

router.post(
  '/users',
  protectClient,
  requireClientPortalRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, username, email, password, role } = req.body || {};
    if (!username?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'username and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const normalizedUsername = String(username).toLowerCase().trim();
    if (!USERNAME_RE.test(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3–60 chars, lowercase letters/digits/dot/underscore/hyphen',
      });
    }
    const normalizedEmail = email ? String(email).toLowerCase().trim() : '';
    const normalizedRole = role === 'admin' ? 'admin' : 'telecaller';

    // Friendlier duplicate messages than the raw E11000 from the indexes.
    const usernameClash = await ClientPortalUser.findOne({ clientId: req.clientId, username: normalizedUsername });
    if (usernameClash) {
      return res.status(409).json({ success: false, message: 'A user with this username already exists' });
    }
    if (normalizedEmail) {
      const emailClash = await ClientPortalUser.findOne({ clientId: req.clientId, email: normalizedEmail });
      if (emailClash) {
        return res.status(409).json({ success: false, message: 'A user with this email already exists' });
      }
    }

    const user = await ClientPortalUser.create({
      clientId: req.clientId,
      // Frontend no longer collects a display name; default to the
      // username so any legacy code that reads `user.name` still works.
      name: name?.trim() || normalizedUsername,
      username: normalizedUsername,
      email: normalizedEmail,
      password,                        // pre-save hook hashes
      role: normalizedRole,
      isActive: true,
      createdBy: req.portalUser?._id,
    });
    res.status(201).json({ success: true, user: sanitize(user) });
  })
);

router.put(
  '/users/:userId',
  protectClient,
  requireClientPortalRole('admin'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }
    const user = await ClientPortalUser.findOne({ _id: userId, clientId: req.clientId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Last-admin guard — don't let an admin demote/deactivate themselves
    // into locking the client out of user management.
    if (
      user.role === 'admin' &&
      ((req.body.role && req.body.role !== 'admin') || req.body.isActive === false)
    ) {
      const otherAdmins = await ClientPortalUser.countDocuments({
        clientId: req.clientId,
        role: 'admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (otherAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote or deactivate the last active admin. Promote another user first.',
        });
      }
    }

    const { name, username, role, isActive, password, email } = req.body || {};
    if (typeof name === 'string' && name.trim()) user.name = name.trim();
    if (role === 'admin' || role === 'telecaller') user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (typeof username === 'string') {
      const normalizedUsername = username.toLowerCase().trim();
      if (normalizedUsername && normalizedUsername !== user.username) {
        if (!USERNAME_RE.test(normalizedUsername)) {
          return res.status(400).json({
            success: false,
            message: 'Username must be 3–60 chars, lowercase letters/digits/dot/underscore/hyphen',
          });
        }
        const usernameClash = await ClientPortalUser.findOne({
          clientId: req.clientId,
          username: normalizedUsername,
          _id: { $ne: user._id },
        });
        if (usernameClash) {
          return res.status(409).json({ success: false, message: 'A user with this username already exists' });
        }
        user.username = normalizedUsername;
      }
    }
    if (typeof email === 'string') {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail && normalizedEmail !== user.email) {
        const emailClash = await ClientPortalUser.findOne({
          clientId: req.clientId,
          email: normalizedEmail,
          _id: { $ne: user._id },
        });
        if (emailClash) {
          return res.status(409).json({ success: false, message: 'A user with this email already exists' });
        }
      }
      user.email = normalizedEmail;
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      user.password = password;        // pre-save hook hashes
    }
    await user.save();
    res.json({ success: true, user: sanitize(user) });
  })
);

router.delete(
  '/users/:userId',
  protectClient,
  requireClientPortalRole('admin'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }
    const user = await ClientPortalUser.findOne({ _id: userId, clientId: req.clientId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Block deleting yourself — easy footgun.
    if (req.portalUser && String(req.portalUser._id) === String(user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    // Last-admin guard.
    if (user.role === 'admin') {
      const otherAdmins = await ClientPortalUser.countDocuments({
        clientId: req.clientId,
        role: 'admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (otherAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last active admin.',
        });
      }
    }
    await user.deleteOne();
    res.json({ success: true, message: 'User deleted' });
  })
);

export default router;
