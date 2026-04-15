import DailyLeadData from '../models/DailyLeadData.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Get all daily lead data
 * @route   GET /api/daily-lead-data
 * @access  Private
 */
export const getDailyLeadData = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, dateFrom, dateTo, clientId } = req.query;

  const query = {};

  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo);
  }

  if (clientId) {
    query.client = clientId;
  }

  const data = await DailyLeadData.find(query)
    .populate('recordedBy', 'name email userID')
    .populate('client', 'name email company status')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ date: -1 });

  const count = await DailyLeadData.countDocuments(query);

  res.status(200).json({
    success: true,
    count: data.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data,
  });
});

/**
 * @desc    Get single daily lead data
 * @route   GET /api/daily-lead-data/:id
 * @access  Private
 */
export const getDailyLeadDataById = asyncHandler(async (req, res) => {
  const data = await DailyLeadData.findById(req.params.id)
    .populate('recordedBy', 'name email userID')
    .populate('client', 'name email company status');

  if (!data) {
    return res.status(404).json({
      success: false,
      message: 'Daily lead data not found',
    });
  }

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * @desc    Get daily lead data by date
 * @route   GET /api/daily-lead-data/date/:date
 * @access  Private
 */
export const getDailyLeadDataByDate = asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const query = { date: new Date(req.params.date) };

  if (clientId) {
    query.client = clientId;
  }

  const data = await DailyLeadData.find(query)
    .populate('recordedBy', 'name email userID')
    .populate('client', 'name email company status');

  res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
});

/**
 * @desc    Create daily lead data
 * @route   POST /api/daily-lead-data
 * @access  Private
 */
export const createDailyLeadData = asyncHandler(async (req, res) => {
  req.body.recordedBy = req.user._id;

  // Check if data already exists for this date and client combination
  const existingData = await DailyLeadData.findOne({
    date: req.body.date,
    client: req.body.client,
  });

  if (existingData) {
    return res.status(400).json({
      success: false,
      message: 'Daily lead data already exists for this client on this date',
    });
  }

  const data = await DailyLeadData.create(req.body);

  // Populate client info before returning
  await data.populate('client', 'name email company status');

  res.status(201).json({
    success: true,
    data,
  });
});

/**
 * @desc    Update daily lead data
 * @route   PUT /api/daily-lead-data/:id
 * @access  Private
 */
export const updateDailyLeadData = asyncHandler(async (req, res) => {
  let data = await DailyLeadData.findById(req.params.id);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: 'Daily lead data not found',
    });
  }

  data = await DailyLeadData.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // Populate client info before returning
  await data.populate('client', 'name email company status');

  res.status(200).json({
    success: true,
    data,
  });
});

/**
 * @desc    Delete daily lead data
 * @route   DELETE /api/daily-lead-data/:id
 * @access  Private
 */
export const deleteDailyLeadData = asyncHandler(async (req, res) => {
  const data = await DailyLeadData.findById(req.params.id);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: 'Daily lead data not found',
    });
  }

  await data.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Daily lead data deleted successfully',
  });
});

/**
 * @desc    Get daily lead data stats
 * @route   GET /api/daily-lead-data/stats/summary
 * @access  Private
 */
export const getDailyLeadDataStats = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, clientId } = req.query;

  const matchStage = {};
  if (dateFrom || dateTo) {
    matchStage.date = {};
    if (dateFrom) matchStage.date.$gte = new Date(dateFrom);
    if (dateTo) matchStage.date.$lte = new Date(dateTo);
  }

  if (clientId) {
    const mongoose = (await import('mongoose')).default;
    matchStage.client = new mongoose.Types.ObjectId(clientId);
  }

  const stats = await DailyLeadData.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLeads: { $sum: '$totalLeads' },
        totalSpend: { $sum: '$totalSpend' },
        totalRevenue: { $sum: '$totalRevenue' },
        totalConversions: { $sum: '$totalConversions' },
        avgCPL: { $avg: '$averageCPL' },
        avgROI: { $avg: '$roi' },
        metaTotalLeads: { $sum: '$metaData.totalLeads' },
        metaTotalSpend: { $sum: '$metaData.spend' },
        googleTotalLeads: { $sum: '$googleData.totalLeads' },
        googleTotalSpend: { $sum: '$googleData.spend' },
        entriesCount: { $sum: 1 },
        uniqueClients: { $addToSet: '$client' },
      },
    },
    {
      $project: {
        _id: 0,
        totalLeads: 1,
        totalSpend: 1,
        totalRevenue: 1,
        totalConversions: 1,
        avgCPL: 1,
        avgROI: 1,
        metaTotalLeads: 1,
        metaTotalSpend: 1,
        googleTotalLeads: 1,
        googleTotalSpend: 1,
        entriesCount: 1,
        activeClients: { $size: '$uniqueClients' },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: stats[0] || {
      totalLeads: 0,
      totalSpend: 0,
      totalRevenue: 0,
      totalConversions: 0,
      avgCPL: 0,
      avgROI: 0,
      metaTotalLeads: 0,
      metaTotalSpend: 0,
      googleTotalLeads: 0,
      googleTotalSpend: 0,
      entriesCount: 0,
      activeClients: 0,
    },
  });
});

/**
 * @desc    Get campaign comparison
 * @route   GET /api/daily-lead-data/stats/campaign-comparison
 * @access  Private
 */
export const getCampaignComparison = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const matchStage = {};
  if (dateFrom || dateTo) {
    matchStage.date = {};
    if (dateFrom) matchStage.date.$gte = new Date(dateFrom);
    if (dateTo) matchStage.date.$lte = new Date(dateTo);
  }

  const comparison = await DailyLeadData.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        meta: {
          totalLeads: { $sum: '$metaData.totalLeads' },
          totalSpend: { $sum: '$metaData.spend' },
          totalRevenue: { $sum: '$metaData.revenue' },
          totalConversions: { $sum: '$metaData.conversions' },
        },
        google: {
          totalLeads: { $sum: '$googleData.totalLeads' },
          totalSpend: { $sum: '$googleData.spend' },
          totalRevenue: { $sum: '$googleData.revenue' },
          totalConversions: { $sum: '$googleData.conversions' },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: comparison[0] || { meta: {}, google: {} },
  });
});
