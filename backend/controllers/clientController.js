import Client from '../models/Client.js';
import DailyEntry from '../models/DailyEntry.js';
import FundEntry from '../models/FundEntry.js';
import ContentEntry from '../models/ContentEntry.js';
import Lead from '../models/Lead.js';
import Vault from '../models/Vault.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { decrypt } from '../utils/encryption.js';

const MAIN_API_URL = process.env.MAIN_API_URL || 'https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net';

const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
};

/**
 * @desc    Get all clients
 * @route   GET /api/clients
 * @access  Private
 */
export const getClients = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const skip = (page - 1) * limit;

  const clients = await Client.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Client.countDocuments();

  res.status(200).json({
    success: true,
    count: clients.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: clients,
  });
});

/**
 * @desc    Get single client
 * @route   GET /api/clients/:id
 * @access  Private
 */
export const getClient = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  res.status(200).json({
    success: true,
    data: client,
  });
});

/**
 * @desc    Create new client
 * @route   POST /api/clients
 * @access  Private
 */
export const createClient = asyncHandler(async (req, res) => {
  const {
    clientName,
    place,
    organisationType,
    address,
    onboardDate,
    gstNumber,
    status,
    accountID,
    customerID,
    removalReason,
    links,
    team,
    assignedSMM,
    assignedSME,
    creativeCommitment,
    staticCommitment,
    motionCreative,
    notes,
  } = req.body;

  // Validate required field
  if (!clientName) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields.',
    });
  }

  const client = await Client.create({
    clientName,
    place: place || '',
    organisationType: organisationType || '',
    address: address || '',
    onboardDate: onboardDate || new Date(),
    gstNumber: gstNumber || '',
    status: status || 'active',
    accountID: accountID || '',
    customerID: customerID || '',
    removalReason: removalReason || '',
    links: links || [],
    team: team || '',
    assignedSMM: assignedSMM || '',
    assignedSME: assignedSME || '',
    creativeCommitment: creativeCommitment || '',
    staticCommitment: staticCommitment || '',
    motionCreative: motionCreative || '',
    notes: notes || '',
  });

  res.status(201).json({
    success: true,
    data: client,
  });
});

/**
 * @desc    Update client
 * @route   PUT /api/clients/:id
 * @access  Private
 */
export const updateClient = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id).select('+portalPassword');

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  // Never allow the generic client-update endpoint to write billing fields.
  // Billing state is ledger-managed and must go through /api/payments,
  // /api/billing/:id/reset, or /api/billing/:id/reconcile.
  const { billing, ...safeBody } = req.body || {};

  // If portalPassword is being set, use save() so the pre-save hash runs
  const hasPortalPassword = safeBody.portalPassword && safeBody.portalPassword.trim();

  if (hasPortalPassword) {
    Object.keys(safeBody).forEach(key => {
      client[key] = safeBody[key];
    });
    await client.save();
    const result = client.toObject();
    delete result.portalPassword;
    return res.status(200).json({ success: true, data: result });
  }

  // No password change — strip empty portalPassword to avoid overwriting hash
  const updateData = { ...safeBody };
  delete updateData.portalPassword;

  const updated = await Client.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: updated,
  });
});

/**
 * @desc    Delete client
 * @route   DELETE /api/clients/:id
 * @access  Private
 */
export const deleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  const clientIdStr = client._id.toString();
  const clientName = client.clientName;

  // Cascade delete all related data
  await Promise.all([
    DailyEntry.deleteMany({ clientId: clientIdStr }),
    FundEntry.deleteMany({ $or: [{ client: client._id }, { clientId: clientIdStr }] }),
    ContentEntry.deleteMany({ clientName }),
    Lead.deleteMany({ client: client._id }),
    Vault.deleteMany({ clientId: clientIdStr }),
  ]);

  await client.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Client and all related data deleted successfully',
  });
});

/**
 * @desc    Drop (soft-delete) a client — keeps the row + every related
 *          record so re-onboarding restores the full history.
 * @route   PATCH /api/clients/:id/drop
 * @access  Private
 *
 * Body: { reason: string }   (required)
 */
export const dropClient = asyncHandler(async (req, res) => {
  const reason = (req.body?.reason || '').trim();
  if (!reason) {
    return res.status(400).json({ success: false, message: 'A reason is required to drop a client' });
  }
  const client = await Client.findById(req.params.id);
  if (!client) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }
  if (client.status === 'dropped') {
    return res.status(400).json({ success: false, message: 'Client is already dropped' });
  }

  const at = new Date();
  const by = req.user?.name || req.user?.email || '';
  client.status = 'dropped';
  client.drop_reason = reason;
  client.dropped_at = at;
  client.dropped_by = by;
  // Reset reonboarded_at — it'll be set fresh on the next reactivate.
  client.reonboarded_at = null;
  if (!Array.isArray(client.drop_history)) client.drop_history = [];
  client.drop_history.push({ action: 'dropped', reason, at, by });
  await client.save();

  res.json({
    success: true,
    message: `${client.clientName} dropped successfully`,
    data: client,
  });
});

/**
 * @desc    Re-onboard a previously dropped client. Flips status back
 *          to 'active' and appends a reonboard event to the history.
 *          All related records (leads, daily entries, funds, content,
 *          vault) are untouched because drop never deleted them.
 * @route   PATCH /api/clients/:id/reonboard
 * @access  Private
 */
export const reonboardClient = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }
  if (client.status !== 'dropped') {
    return res.status(400).json({ success: false, message: 'Client is not currently dropped' });
  }

  const at = new Date();
  const by = req.user?.name || req.user?.email || '';
  client.status = 'active';
  client.reonboarded_at = at;
  // Keep drop_reason / dropped_at so the past event is still queryable;
  // the history array holds the full timeline.
  if (!Array.isArray(client.drop_history)) client.drop_history = [];
  client.drop_history.push({ action: 'reonboarded', reason: '', at, by });
  await client.save();

  res.json({
    success: true,
    message: `${client.clientName} re-onboarded successfully`,
    data: client,
  });
});

/**
 * @desc    Update client status
 * @route   PATCH /api/clients/:id/status
 * @access  Private
 */
/**
 * @desc    Reveal the client's portal password in plaintext for admin
 *          recovery (e.g. when a client forgets their login). Reads
 *          the encrypted copy stored alongside the bcrypt hash and
 *          decrypts it on the server. Returns empty when no
 *          recoverable copy exists (older clients saved before this
 *          field was added).
 * @route   GET /api/clients/:id/portal-credentials
 * @access  Private (CLIENT_UPDATE permission)
 */
export const revealPortalPassword = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id).select('+portalPasswordEnc portalEmail clientName');
  if (!client) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }

  let password = '';
  if (client.portalPasswordEnc) {
    try {
      password = decrypt(client.portalPasswordEnc);
    } catch (err) {
      // Encryption key changed / corrupted ciphertext — fail soft
      // so the UI can show a "couldn't recover" hint without crashing.
      console.error('revealPortalPassword decrypt failed:', err?.message);
      password = '';
    }
  }

  res.json({
    success: true,
    data: {
      clientName: client.clientName,
      portalEmail: client.portalEmail || '',
      portalPassword: password,
      // hasRecoverable tells the UI whether to show "Reveal" or
      // "Reset password" — old records (saved before this feature)
      // have no encrypted copy.
      hasRecoverable: !!password,
    },
  });
});

export const updateClientStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const client = await Client.findByIdAndUpdate(
    req.params.id,
    { $set: { status } },
    { new: true }
  );

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  res.status(200).json({
    success: true,
    data: client,
  });
});

/**
 * @desc    Get client stats
 * @route   GET /api/clients/stats
 * @access  Private
 */
export const getClientStats = asyncHandler(async (req, res) => {
  const totalClients = await Client.countDocuments();
  const activeClients = await Client.countDocuments({ status: 'active' });
  const inactiveClients = await Client.countDocuments({ status: 'inactive' });

  const clientsByStatus = await Client.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalClients,
      activeClients,
      inactiveClients,
      clientsByStatus,
    },
  });
});

