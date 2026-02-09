import Lead from '../models/Lead.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Get all leads
 * @route   GET /api/leads
 * @access  Private
 */
export const getLeads = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, status, source } = req.query;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (source) {
    query.source = source;
  }

  const leads = await Lead.find(query)
    .populate('assignedTo', 'name email userID')
    .populate('client', 'name email company')
    .populate('createdBy', 'name email userID')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const count = await Lead.countDocuments(query);

  res.status(200).json({
    success: true,
    count: leads.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data: leads,
  });
});

/**
 * @desc    Get single lead
 * @route   GET /api/leads/:id
 * @access  Private
 */
export const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id)
    .populate('assignedTo', 'name email userID')
    .populate('client', 'name email company')
    .populate('createdBy', 'name email userID');

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found',
    });
  }

  res.status(200).json({
    success: true,
    data: lead,
  });
});

/**
 * @desc    Create lead
 * @route   POST /api/leads
 * @access  Private
 */
export const createLead = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user.id;

  const lead = await Lead.create(req.body);

  res.status(201).json({
    success: true,
    data: lead,
  });
});

/**
 * @desc    Update lead
 * @route   PUT /api/leads/:id
 * @access  Private
 */
export const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found',
    });
  }

  res.status(200).json({
    success: true,
    data: lead,
  });
});

/**
 * @desc    Delete lead
 * @route   DELETE /api/leads/:id
 * @access  Private
 */
export const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found',
    });
  }

  await lead.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Lead deleted successfully',
  });
});

/**
 * @desc    Get lead stats
 * @route   GET /api/leads/stats/summary
 * @access  Private
 */
export const getLeadStats = asyncHandler(async (req, res) => {
  const stats = await Lead.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
      },
    },
  ]);

  const sourceStats = await Lead.aggregate([
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
      },
    },
  ]);

  const totalLeads = await Lead.countDocuments();
  const totalValue = await Lead.aggregate([
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalLeads,
      totalValue: totalValue[0]?.total || 0,
      byStatus: stats,
      bySource: sourceStats,
    },
  });
});
