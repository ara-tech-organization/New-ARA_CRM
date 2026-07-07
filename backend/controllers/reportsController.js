import Client from '../models/Client.js';
import DailyEntry from '../models/DailyEntry.js';
import DailyLeadData from '../models/DailyLeadData.js';
import Lead from '../models/Lead.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Get dashboard overview
 * @route   GET /api/reports/dashboard
 * @access  Private
 */
export const getDashboardOverview = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const dateFilter = {};
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {};
    if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
  }

  // Get counts
  const [
    totalClients,
    totalUsers,
    activeClients,
    newClientsThisMonth,
  ] = await Promise.all([
    Client.countDocuments(),
    User.countDocuments({ isActive: true }),
    Client.countDocuments({ status: 'active' }),
    Client.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    }),
  ]);

  // Revenue / expense tracking previously derived from the FundEntry
  // collection, which has been removed. Zero these out so the endpoint
  // still responds with a stable shape; wire in a new source later if
  // financial reports are re-introduced.
  const totalRevenue = 0;
  const totalExpense = 0;
  const netProfit = 0;

  res.status(200).json({
    success: true,
    data: {
      totalClients,
      totalUsers,
      activeClients,
      newClientsThisMonth,
      totalRevenue,
      totalExpense,
      netProfit,
    },
  });
});

/**
 * @desc    Get sales report
 * @route   GET /api/reports/sales
 * @access  Private
 */
export const getSalesReport = asyncHandler(async (req, res) => {
  // Sales aggregate previously came from FundEntry (removed). Return an
  // empty series so consumers keep working; hook up a replacement source
  // when financial reporting is rebuilt.
  const salesData = [];
  const totalSales = 0;
  const totalTransactions = 0;

  res.status(200).json({
    success: true,
    data: {
      salesData,
      summary: {
        totalSales,
        totalTransactions,
        averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      },
    },
  });
});


/**
 * @desc    Get campaign performance report
 * @route   GET /api/reports/campaign-performance
 * @access  Private
 */
export const getCampaignPerformanceReport = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const matchStage = {};
  if (dateFrom || dateTo) {
    matchStage.date = {};
    if (dateFrom) matchStage.date.$gte = new Date(dateFrom);
    if (dateTo) matchStage.date.$lte = new Date(dateTo);
  }

  const campaignData = await DailyLeadData.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        metaLeads: { $sum: '$metaData.totalLeads' },
        metaSpend: { $sum: '$metaData.spend' },
        metaRevenue: { $sum: '$metaData.revenue' },
        metaConversions: { $sum: '$metaData.conversions' },
        googleLeads: { $sum: '$googleData.totalLeads' },
        googleSpend: { $sum: '$googleData.spend' },
        googleRevenue: { $sum: '$googleData.revenue' },
        googleConversions: { $sum: '$googleData.conversions' },
      },
    },
  ]);

  const data = campaignData[0] || {};

  // Calculate performance metrics
  const metaROI = data.metaSpend > 0 ? ((data.metaRevenue - data.metaSpend) / data.metaSpend) * 100 : 0;
  const googleROI = data.googleSpend > 0 ? ((data.googleRevenue - data.googleSpend) / data.googleSpend) * 100 : 0;
  const metaCPL = data.metaLeads > 0 ? data.metaSpend / data.metaLeads : 0;
  const googleCPL = data.googleLeads > 0 ? data.googleSpend / data.googleLeads : 0;

  res.status(200).json({
    success: true,
    data: {
      meta: {
        totalLeads: data.metaLeads || 0,
        totalSpend: data.metaSpend || 0,
        totalRevenue: data.metaRevenue || 0,
        totalConversions: data.metaConversions || 0,
        roi: metaROI.toFixed(2),
        cpl: metaCPL.toFixed(2),
      },
      google: {
        totalLeads: data.googleLeads || 0,
        totalSpend: data.googleSpend || 0,
        totalRevenue: data.googleRevenue || 0,
        totalConversions: data.googleConversions || 0,
        roi: googleROI.toFixed(2),
        cpl: googleCPL.toFixed(2),
      },
      overall: {
        totalLeads: (data.metaLeads || 0) + (data.googleLeads || 0),
        totalSpend: (data.metaSpend || 0) + (data.googleSpend || 0),
        totalRevenue: (data.metaRevenue || 0) + (data.googleRevenue || 0),
        totalConversions: (data.metaConversions || 0) + (data.googleConversions || 0),
      },
    },
  });
});

/**
 * @desc    Get user performance report
 * @route   GET /api/reports/user-performance
 * @access  Private (Admin/Superadmin)
 */
export const getUserPerformanceReport = asyncHandler(async (req, res) => {
  const users = await User.find({ isActive: true }).select('userID name email role');

  res.status(200).json({
    success: true,
    data: users,
  });
});

/**
 * @desc    Get lead performance report
 * @route   GET /api/reports/lead-performance
 * @access  Private
 */
export const getLeadPerformanceReport = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const matchStage = {};
  if (dateFrom || dateTo) {
    matchStage.createdAt = {};
    if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
  }

  // Get leads by status
  const statusStats = await Lead.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
      },
    },
  ]);

  // Get leads by source
  const sourceStats = await Lead.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
      },
    },
  ]);

  // Get total stats
  const totalStats = await Lead.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLeads: { $sum: 1 },
        totalValue: { $sum: '$value' },
        avgValue: { $avg: '$value' },
      },
    },
  ]);

  // Calculate conversion rate
  const convertedLeads = statusStats.find(s => s._id === 'converted')?.count || 0;
  const totalLeads = totalStats[0]?.totalLeads || 0;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0;

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalLeads,
        totalValue: totalStats[0]?.totalValue || 0,
        avgValue: totalStats[0]?.avgValue || 0,
        conversionRate,
        convertedLeads,
      },
      byStatus: statusStats,
      bySource: sourceStats,
    },
  });
});

/**
 * @desc    Get financial report
 * @route   GET /api/reports/financial
 * @access  Private (Admin/Superadmin)
 */
export const getFinancialReport = asyncHandler(async (req, res) => {
  // Financial series previously came from FundEntry (removed). Return
  // an empty object so callers keep responding with the same shape;
  // repopulate when a replacement financial source is wired up.
  const formattedData = {};

  res.status(200).json({
    success: true,
    data: formattedData,
  });
});
