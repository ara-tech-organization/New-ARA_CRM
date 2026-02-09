import FundEntry from '../models/FundEntry.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Get all fund entries
 * @route   GET /api/fund-entries
 * @access  Private
 */
export const getFundEntries = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    category,
    status,
    clientId,
    dateFrom,
    dateTo,
  } = req.query;

  const query = {};

  if (type) query.type = type;
  if (category) query.category = category;
  if (status) query.status = status;
  if (clientId) query.client = clientId;

  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo);
  }

  const entries = await FundEntry.find(query)
    .populate('client', 'name email clientID company')
    .populate('recordedBy', 'name email userID')
    .populate('approvedBy', 'name email userID')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ date: -1 });

  const count = await FundEntry.countDocuments(query);

  res.status(200).json({
    success: true,
    count: entries.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data: entries,
  });
});

/**
 * @desc    Get single fund entry
 * @route   GET /api/fund-entries/:id
 * @access  Private
 */
export const getFundEntry = asyncHandler(async (req, res) => {
  const entry = await FundEntry.findById(req.params.id)
    .populate('client', 'name email clientID company')
    .populate('recordedBy', 'name email userID')
    .populate('approvedBy', 'name email userID');

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'Fund entry not found',
    });
  }

  res.status(200).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Create fund entry
 * @route   POST /api/fund-entries
 * @access  Private
 */
export const createFundEntry = asyncHandler(async (req, res) => {
  req.body.recordedBy = req.user.id;

  const entry = await FundEntry.create(req.body);

  res.status(201).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Update fund entry
 * @route   PUT /api/fund-entries/:id
 * @access  Private
 */
export const updateFundEntry = asyncHandler(async (req, res) => {
  let entry = await FundEntry.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'Fund entry not found',
    });
  }

  entry = await FundEntry.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Delete fund entry
 * @route   DELETE /api/fund-entries/:id
 * @access  Private
 */
export const deleteFundEntry = asyncHandler(async (req, res) => {
  const entry = await FundEntry.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'Fund entry not found',
    });
  }

  await entry.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Fund entry deleted successfully',
  });
});

/**
 * @desc    Approve fund entry
 * @route   PATCH /api/fund-entries/:id/approve
 * @access  Private (Admin/Superadmin)
 */
export const approveFundEntry = asyncHandler(async (req, res) => {
  const entry = await FundEntry.findByIdAndUpdate(
    req.params.id,
    {
      status: 'completed',
      approvedBy: req.user.id,
      approvalDate: Date.now(),
    },
    { new: true, runValidators: true }
  );

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'Fund entry not found',
    });
  }

  res.status(200).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Get fund entry stats
 * @route   GET /api/fund-entries/stats/summary
 * @access  Private
 */
export const getFundEntryStats = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const matchStage = { status: 'completed' };
  if (dateFrom || dateTo) {
    matchStage.date = {};
    if (dateFrom) matchStage.date.$gte = new Date(dateFrom);
    if (dateTo) matchStage.date.$lte = new Date(dateTo);
  }

  const stats = await FundEntry.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const categoryStats = await FundEntry.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Calculate totals
  const income = stats.find((s) => s._id === 'income')?.totalAmount || 0;
  const expense = stats.find((s) => s._id === 'expense')?.totalAmount || 0;
  const netProfit = income - expense;

  res.status(200).json({
    success: true,
    data: {
      byType: stats,
      byCategory: categoryStats,
      summary: {
        totalIncome: income,
        totalExpense: expense,
        netProfit,
      },
    },
  });
});

/**
 * @desc    Get fund entries by client
 * @route   GET /api/fund-entries/client/:clientId
 * @access  Private
 */
export const getFundEntriesByClient = asyncHandler(async (req, res) => {
  const entries = await FundEntry.find({ client: req.params.clientId })
    .populate('recordedBy', 'name email userID')
    .sort({ date: -1 });

  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);

  res.status(200).json({
    success: true,
    count: entries.length,
    totalAmount,
    data: entries,
  });
});
