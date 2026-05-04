import jwt from 'jsonwebtoken';
import Client from '../models/Client.js';
import ClientPortalUser from '../models/ClientPortalUser.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const signToken = (user) =>
  jwt.sign(
    {
      // We keep `id` on the JWT for backward compat — protectClient already
      // calls jwt.verify and reads decoded.role + decoded.clientId.
      id: user._id,
      role: user.role,            // 'admin' | 'telecaller' (replaces legacy 'client')
      clientId: user.clientId.toString(),
      userId: user._id.toString(),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );

/**
 * @desc    Client portal login
 * @route   POST /api/auth/client-login
 * @access  Public
 *
 * Resolves credentials against the ClientPortalUser collection. The first
 * time someone logs in for a Client whose portal users haven't been
 * created yet, the legacy `portalEmail`/`portalPassword` on the Client
 * doc seeds a single `admin` user — so existing client logins keep
 * working with no manual migration.
 */
// Pulls the login identifier from the request — accepts `username`,
// `email`, or `identifier` so the same endpoint serves admins (who tend
// to have an email) and telecallers (who only have a username).
const extractIdentifier = (body) =>
  String(body?.username || body?.identifier || body?.email || '').toLowerCase().trim();

// Email-shaped strings hit the email branch; everything else is a username.
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Generate a username from an email's local-part, sanitized to match the
// model's allowed character class. Falls back to a stable suffix derived
// from the client's _id when the local-part is too short.
const usernameFromEmail = (email, clientIdSuffix = '') => {
  const local = String(email || '').split('@')[0] || '';
  const cleaned = local.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 50);
  if (cleaned.length >= 3) return cleaned;
  return `admin${clientIdSuffix.slice(-6)}`;
};

export const clientLogin = asyncHandler(async (req, res) => {
  const identifier = extractIdentifier(req.body);
  const password = req.body?.password;
  // Diagnostic prefix — search the backend log for `[client-login]` to
  // see exactly which branch rejected. Safe to keep in production: it
  // never logs the password and only the first chars of the identifier.
  const tag = `[client-login] "${identifier.slice(0, 4)}…"`;

  if (!identifier || !password) {
    console.warn(`${tag} reject: missing identifier or password`);
    return res.status(400).json({ success: false, message: 'Please provide username/email and password' });
  }

  // 1) Modern path — match by username first (canonical), then email.
  const query = looksLikeEmail(identifier)
    ? { $or: [{ username: identifier }, { email: identifier }] }
    : { username: identifier };

  let user = await ClientPortalUser.findOne({ ...query, isActive: true })
    .select('+password')
    .lean(false);

  if (user) {
    console.info(`${tag} matched ClientPortalUser ${user._id} role=${user.role}`);
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.warn(`${tag} reject: ClientPortalUser found but password mismatch`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    return respondWithUser(res, user);
  }

  // Helpful trace: an inactive user shouldn't pass step 1 above, but if
  // someone deactivated themselves they'll wonder why login fails.
  const inactiveHit = await ClientPortalUser.findOne({ ...query }).lean();
  if (inactiveHit) {
    console.warn(`${tag} reject: matching ClientPortalUser is deactivated`);
    return res.status(401).json({ success: false, message: 'Account is deactivated' });
  }

  // 2) Legacy fallback — match against Client.portalEmail/portalPassword and
  //    auto-create a seed admin ClientPortalUser so the next login uses path 1.
  //    Only triggers when the identifier is email-shaped.
  if (!looksLikeEmail(identifier)) {
    console.warn(`${tag} reject: no ClientPortalUser with username "${identifier}" (and not email-shaped, so legacy path skipped)`);
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const client = await Client.findOne({ portalEmail: identifier, portalEnabled: true })
    .select('+portalPassword');

  if (!client) {
    const exists = await Client.findOne({ portalEmail: identifier }).select('clientName portalEnabled');
    if (exists) {
      console.warn(`${tag} reject: Client found but portalEnabled=false`);
    } else {
      console.warn(`${tag} reject: no Client with portalEmail "${identifier}" and no ClientPortalUser`);
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  if (!client.portalPassword) {
    console.warn(`${tag} reject: Client found but no portalPassword set`);
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const legacyMatch = await client.matchPortalPassword(password);
  if (!legacyMatch) {
    console.warn(`${tag} reject: legacy Client.portalPassword mismatch`);
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  // Seed / self-heal the admin user. The legacy email+password check we
  // just passed is proof of original client ownership, so we GUARANTEE an
  // admin exists for this client after this branch runs:
  //
  //  - If no ClientPortalUser exists for this email → create one as admin.
  //  - If one exists for this email but is not admin AND no other admin
  //    exists for the client → promote it (covers the case where the
  //    very first ClientPortalUser was created with the model's default
  //    role of 'telecaller', leaving the client locked out of the
  //    Users tab).
  //  - If one exists and is already admin (or there's already a separate
  //    admin elsewhere) → leave the record alone; just log them in.
  user = await ClientPortalUser.findOne({ clientId: client._id, email: identifier });
  if (!user) {
    user = await ClientPortalUser.create({
      clientId: client._id,
      name: client.clientName || 'Portal Admin',
      username: usernameFromEmail(identifier, String(client._id)),
      email: identifier,
      password,                  // plaintext; pre-save hashes
      role: 'admin',
      isActive: true,
    });
  } else if (user.role !== 'admin') {
    const otherAdmins = await ClientPortalUser.countDocuments({
      clientId: client._id,
      role: 'admin',
      isActive: true,
      _id: { $ne: user._id },
    });
    if (otherAdmins === 0) {
      user.role = 'admin';
      user.isActive = true;
      await user.save();
    }
  }

  // Defensive: if the user record predates the username field (older row
  // created before the schema rolled out, or one created via a buggy
  // path), backfill the username so the next login can resolve directly
  // by username.
  if (!user.username) {
    user.username = usernameFromEmail(user.email || identifier, String(client._id));
    await user.save();
  }

  return respondWithUser(res, user);
});

const respondWithUser = async (res, user) => {
  const client = await Client.findById(user.clientId)
    .select('clientName place portalEmail google_ads_enabled meta_enabled')
    .lean();

  const token = signToken(user);
  res.status(200).json({
    success: true,
    accessToken: token,
    client: {
      _id: user.clientId,
      clientName: client?.clientName || '',
      place: client?.place || '',
      portalEmail: client?.portalEmail || '',
      googleAdsEnabled: !!client?.google_ads_enabled,
      metaEnabled: !!client?.meta_enabled,
    },
    user: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email || '',
      role: user.role,
    },
  });
};

/**
 * @desc    Get current portal user + client info
 * @route   GET /api/auth/client-me
 * @access  Private (client portal user)
 */
export const getClientMe = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.clientId)
    .select('clientName place portalEmail google_ads_enabled google_ads_customer_id meta_enabled')
    .lean();
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
      metaEnabled: client.meta_enabled,
    },
    user: req.portalUser
      ? {
          _id: req.portalUser._id,
          name: req.portalUser.name,
          username: req.portalUser.username,
          email: req.portalUser.email || '',
          role: req.portalUser.role,
        }
      : null,
  });
});
