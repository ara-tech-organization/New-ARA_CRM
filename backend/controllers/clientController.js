import Client from '../models/Client.js';
import DailyEntry from '../models/DailyEntry.js';
import FundEntry from '../models/FundEntry.js';
import ContentEntry from '../models/ContentEntry.js';
import Lead from '../models/Lead.js';
import Vault from '../models/Vault.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Get all clients
 * @route   GET /api/clients
 * @access  Private
 */
export const getClients = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 100,
    search,
    status,
    dateFrom,
    dateTo,
  } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { clientName: { $regex: search, $options: 'i' } },
      { place: { $regex: search, $options: 'i' } },
      { organisationType: { $regex: search, $options: 'i' } },
      { accountID: { $regex: search, $options: 'i' } },
    ];
  }

  if (status) query.status = status;

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const clients = await Client.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const count = await Client.countDocuments(query);

  res.status(200).json({
    success: true,
    count: clients.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
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
  let client = await Client.findById(req.params.id);

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Client not found',
    });
  }

  client = await Client.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: client,
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
 * @desc    Update client status
 * @route   PATCH /api/clients/:id/status
 * @access  Private
 */
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
