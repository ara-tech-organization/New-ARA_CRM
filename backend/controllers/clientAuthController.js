import jwt from 'jsonwebtoken';
import Client from '../models/Client.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Client portal login
 * @route   POST /api/auth/client-login
 * @access  Public
 */
export const clientLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  // Find client by portal email (include password field)
  console.log('[client-login] Attempting login for:', email.toLowerCase());
  const client = await Client.findOne({ portalEmail: email.toLowerCase(), portalEnabled: true }).select('+portalPassword');

  if (!client) {
    // Check if client exists but portal is not enabled
    const clientNoPortal = await Client.findOne({ portalEmail: email.toLowerCase() }).select('clientName portalEnabled portalEmail');
    if (clientNoPortal) {
      console.log('[client-login] Client found but portalEnabled =', clientNoPortal.portalEnabled);
    } else {
      console.log('[client-login] No client found with portalEmail:', email.toLowerCase());
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  console.log('[client-login] Client found:', client.clientName, '| Has password:', !!client.portalPassword);

  if (!client.portalPassword) {
    return res.status(401).json({ success: false, message: 'Portal access not configured. Contact administrator.' });
  }

  const isMatch = await client.matchPortalPassword(password);
  console.log('[client-login] Password match:', isMatch);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // Generate token with role: 'client' and clientId
  const token = jwt.sign(
    { id: client._id, role: 'client', clientId: client._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );

  res.status(200).json({
    success: true,
    accessToken: token,
    client: {
      _id: client._id,
      clientName: client.clientName,
      place: client.place,
      portalEmail: client.portalEmail,
      googleAdsEnabled: client.google_ads_enabled,
      role: 'client',
    },
  });
});

/**
 * @desc    Get current client info
 * @route   GET /api/auth/client-me
 * @access  Private (client)
 */
export const getClientMe = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.clientId).select('clientName place portalEmail google_ads_enabled google_ads_customer_id');
  if (!client) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }
  res.status(200).json({
    success: true,
    client: {
      _id: client._id,
      clientName: client.clientName,
      place: client.place,
      portalEmail: client.portalEmail,
      googleAdsEnabled: client.google_ads_enabled,
      role: 'client',
    },
  });
});
