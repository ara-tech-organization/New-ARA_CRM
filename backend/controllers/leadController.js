import Lead from '../models/Lead.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const MAIN_API_URL = process.env.MAIN_API_URL || 'https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net';

// Fetch with timeout
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
 * @desc    Get all leads
 * @route   GET /api/leads
 * @access  Private
 */
export const getLeads = asyncHandler(async (req, res) => {
  try {
    // Forward the incoming Authorization header (or cookie) to the main API
    const headers = {};
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    if (req.headers.cookie) headers.cookie = req.headers.cookie;

    // Forward query string (e.g. ?limit=10000&_t=...)
    const qs = new URLSearchParams(req.query).toString();
    const url = `${MAIN_API_URL}/api/leads${qs ? `?${qs}` : ''}`;

    const response = await fetchWithTimeout(url, { headers }, 20000);

    if (!response.ok) {
      console.error(`Lead proxy: main API returned ${response.status}`);
      return res.status(200).json({ success: true, count: 0, total: 0, data: [] });
    }
    const leads = await response.json();
    const data = Array.isArray(leads) ? leads : (leads.data || []);
    return res.status(200).json({
      success: true,
      count: data.length,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error('Lead proxy error:', error.message);
    return res.status(200).json({ success: true, count: 0, total: 0, data: [] });
  }
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
  req.body.createdBy = req.user._id;

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

