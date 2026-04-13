import ContentEntry from '../models/ContentEntry.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Get all content entries
 * @route   GET /api/content-entries
 * @access  Private
 */
export const getContentEntries = asyncHandler(async (req, res) => {
  const { page = 1, limit = 500, dateFrom, dateTo, clientName, status, assignedSME } = req.query;

  const query = {};

  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  if (clientName) {
    query.clientName = clientName;
  }

  if (status) {
    query.status = status;
  }

  if (assignedSME) {
    query.assignedSME = assignedSME;
  }

  const entries = await ContentEntry.find(query)
    .populate('createdBy', 'name email userID')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const count = await ContentEntry.countDocuments(query);

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
 * @desc    Get content entries by month (for calendar view)
 * @route   GET /api/content-entries/calendar/:year/:month
 * @access  Private
 */
export const getContentEntriesByMonth = asyncHandler(async (req, res) => {
  const { year, month } = req.params;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const entries = await ContentEntry.find({
    date: { $gte: startDate, $lte: endDate },
  })
    .populate('createdBy', 'name email userID')
    .sort({ date: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count: entries.length,
    data: entries,
  });
});

/**
 * @desc    Create content entry
 * @route   POST /api/content-entries
 * @access  Private
 */
export const createContentEntry = asyncHandler(async (req, res) => {
  const { date, clientName, contentType, postTitle, platform, description, referenceVideo, status, assignedSME, approvalStatus, remarks } = req.body;

  if (!date || !clientName || !contentType || !postTitle || !platform) {
    return res.status(400).json({
      success: false,
      message: 'Date, client name, content type, post title, and platform are required',
    });
  }

  const entry = await ContentEntry.create({
    date,
    clientName,
    contentType,
    postTitle,
    platform,
    description: description || '',
    referenceVideo: referenceVideo || '',
    status: status || 'Planned',
    assignedSME: assignedSME || '',
    approvalStatus: approvalStatus || '',
    remarks: remarks || '',
    createdBy: req.user?.id || req.user?._id,
  });

  await entry.populate('createdBy', 'name email userID');

  res.status(201).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Update content entry
 * @route   PUT /api/content-entries/:id
 * @access  Private
 */
export const updateContentEntry = asyncHandler(async (req, res) => {
  const entry = await ContentEntry.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'Content entry not found',
    });
  }

  const allowedFields = [
    'date', 'clientName', 'contentType', 'postTitle',
    'platform', 'description', 'referenceVideo', 'status',
    'assignedSME', 'approvalStatus', 'remarks',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      entry[field] = req.body[field];
    }
  });

  await entry.save();
  await entry.populate('createdBy', 'name email userID');

  res.status(200).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Delete content entry
 * @route   DELETE /api/content-entries/:id
 * @access  Private
 */
export const deleteContentEntry = asyncHandler(async (req, res) => {
  const entry = await ContentEntry.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'Content entry not found',
    });
  }

  await entry.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Content entry deleted successfully',
  });
});
