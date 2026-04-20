import DailyEntry from "../models/DailyEntry.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import mongoose from "mongoose";

// ============================================
// In-Memory Cache for External API Data
// ============================================
const cache = {
  leads: { data: null, timestamp: 0 },
  funds: { data: null, timestamp: 0 },
  clients: { data: null, timestamp: 0 },
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

const isCacheValid = (cacheKey) => {
  return (
    cache[cacheKey].data && Date.now() - cache[cacheKey].timestamp < CACHE_TTL
  );
};

const setCache = (cacheKey, data) => {
  cache[cacheKey] = { data, timestamp: Date.now() };
};

const getCache = (cacheKey) => cache[cacheKey].data;

// Clear cache when needed (e.g., after sync)
export const clearCache = (cacheKey = null) => {
  if (cacheKey) {
    cache[cacheKey] = { data: null, timestamp: 0 };
  } else {
    Object.keys(cache).forEach((key) => {
      cache[key] = { data: null, timestamp: 0 };
    });
  }
};

// Fetch with timeout to prevent hanging requests
const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Main API base URL for fetching synced data
const MAIN_API_URL =
  process.env.MAIN_API_URL ||
  "https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net/api";

// Helper function to get client name from main API
const getClientNameFromMainApi = async (clientId) => {
  try {
    let clients;
    if (isCacheValid("clients")) {
      clients = getCache("clients");
    } else {
      const response = await fetchWithTimeout(
        `${MAIN_API_URL}/api/clients`,
        {},
        10000,
      );
      if (response.ok) {
        clients = await response.json();
        setCache("clients", clients);
      }
    }

    if (clients) {
      const client = clients.find((c) => c._id === clientId);
      return client?.clientName || "";
    }
  } catch (error) {
    console.error("Error fetching client name:", error.message);
  }
  return "";
};

/**
 * @desc    Get all daily entries
 * @route   GET /api/daily-entries
 * @access  Private
 */
export const getDailyEntries = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, dateFrom, dateTo, clientId } = req.query;

  const query = {};

  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo);
  }

  if (clientId) {
    query.clientId = clientId;
  }

  const entries = await DailyEntry.find(query)
    .populate("recordedBy", "name email userID")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ date: -1 })
    .lean();

  const count = await DailyEntry.countDocuments(query);

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
 * @desc    Get single daily entry
 * @route   GET /api/daily-entries/:id
 * @access  Private
 */
export const getDailyEntry = asyncHandler(async (req, res) => {
  const entry = await DailyEntry.findById(req.params.id)
    .populate("recordedBy", "name email userID")
    .lean();

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: "Daily entry not found",
    });
  }

  res.status(200).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Get daily entry by date
 * @route   GET /api/daily-entries/date/:date
 * @access  Private
 */
export const getDailyEntryByDate = asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const query = { date: new Date(req.params.date) };

  if (clientId) {
    query.clientId = clientId;
  }

  const entry = await DailyEntry.findOne(query)
    .populate("recordedBy", "name email userID")
    .lean();

  res.status(200).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Create daily entry
 * @route   POST /api/daily-entries
 * @access  Private
 */
export const createDailyEntry = asyncHandler(async (req, res) => {
  // Map 'client' to 'clientId' for frontend compatibility
  const entryData = { ...req.body };

  // Accept either 'client' or 'clientId' from frontend
  if (entryData.client && !entryData.clientId) {
    entryData.clientId = entryData.client;
    delete entryData.client;
  }

  // Set recordedBy from authenticated user
  if (req.user?.id) {
    entryData.recordedBy = req.user._id;
  }

  // Fetch client name from main API if not provided
  if (!entryData.clientName && entryData.clientId) {
    entryData.clientName = await getClientNameFromMainApi(entryData.clientId);
  }

  try {
    const entry = await DailyEntry.create(entryData);

    // Populate for response
    await entry.populate("recordedBy", "name email userID");

    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error("Create daily entry error:", error.message, error.code);

    // Handle duplicate key error (same client + date combination)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message:
          "An entry already exists for this client on the selected date. Please edit the existing entry or choose a different date.",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    throw error;
  }
});

/**
 * @desc    Update daily entry
 * @route   PUT /api/daily-entries/:id
 * @access  Private
 */
export const updateDailyEntry = asyncHandler(async (req, res) => {
  const entry = await DailyEntry.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: "Daily entry not found",
    });
  }

  // Map 'client' to 'clientId' for frontend compatibility
  const updateData = { ...req.body };
  if (updateData.client && !updateData.clientId) {
    updateData.clientId = updateData.client;
    delete updateData.client;
  }

  // Update fields
  const allowedFields = [
    "date",
    "clientId",
    "clientName",
    "metaForm",
    "metaWhatsapp",
    "metaFund",
    "googleCall",
    "googleWebsite",
    "googleFund",
    "notes",
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      entry[field] = updateData[field];
    }
  });

  // Fetch client name if clientId changed and clientName not provided
  if (updateData.clientId && !updateData.clientName) {
    entry.clientName = await getClientNameFromMainApi(updateData.clientId);
  }

  // Save to trigger pre-save hook for CPL calculations
  await entry.save();

  // Populate for response
  await entry.populate("recordedBy", "name email userID");

  res.status(200).json({
    success: true,
    data: entry,
  });
});

/**
 * @desc    Delete daily entry
 * @route   DELETE /api/daily-entries/:id
 * @access  Private
 */
export const deleteDailyEntry = asyncHandler(async (req, res) => {
  const entry = await DailyEntry.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: "Daily entry not found",
    });
  }

  await entry.deleteOne();

  res.status(200).json({
    success: true,
    message: "Daily entry deleted successfully",
  });
});

/**
 * @desc    Get daily entry stats
 * @route   GET /api/daily-entries/stats/summary
 * @access  Private
 */
export const getDailyEntryStats = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const matchStage = {};
  if (dateFrom || dateTo) {
    matchStage.date = {};
    if (dateFrom) matchStage.date.$gte = new Date(dateFrom);
    if (dateTo) matchStage.date.$lte = new Date(dateTo);
  }

  const stats = await DailyEntry.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalMetaForm: { $sum: "$metaForm" },
        totalMetaWhatsapp: { $sum: "$metaWhatsapp" },
        totalMetaFund: { $sum: "$metaFund" },
        totalGoogleCall: { $sum: "$googleCall" },
        totalGoogleWebsite: { $sum: "$googleWebsite" },
        totalGoogleFund: { $sum: "$googleFund" },
        entriesCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        totalMetaLeads: { $add: ["$totalMetaForm", "$totalMetaWhatsapp"] },
        totalGoogleLeads: { $add: ["$totalGoogleCall", "$totalGoogleWebsite"] },
        totalMetaFund: 1,
        totalGoogleFund: 1,
        totalSpend: { $add: ["$totalMetaFund", "$totalGoogleFund"] },
        entriesCount: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: stats[0] || {
      totalMetaLeads: 0,
      totalGoogleLeads: 0,
      totalMetaFund: 0,
      totalGoogleFund: 0,
      totalSpend: 0,
      entriesCount: 0,
    },
  });
});

/**
 * @desc    Get today's stats for daily entries (optimized single aggregation)
 * @route   GET /api/daily-entries/stats/today
 * @access  Private
 */
export const getTodayStats = asyncHandler(async (req, res) => {
  // Get start and end of today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Single aggregation with $facet to get all stats in one query
  const stats = await DailyEntry.aggregate([
    {
      $facet: {
        // Today's stats
        todayStats: [
          { $match: { date: { $gte: today, $lt: tomorrow } } },
          {
            $group: {
              _id: null,
              todayLeads: { $sum: "$totalLeads" },
              todaySpend: { $sum: "$totalSpend" },
              todayEntries: { $sum: 1 },
              todayClients: { $addToSet: "$clientId" },
            },
          },
          {
            $project: {
              _id: 0,
              todayLeads: 1,
              todaySpend: 1,
              todayEntries: 1,
              todayClients: { $size: "$todayClients" },
            },
          },
        ],
        // All-time stats
        allTimeStats: [
          {
            $group: {
              _id: null,
              totalEntries: { $sum: 1 },
              uniqueClients: { $addToSet: "$clientId" },
            },
          },
          {
            $project: {
              _id: 0,
              totalEntries: 1,
              activeClients: { $size: "$uniqueClients" },
            },
          },
        ],
      },
    },
  ]);

  const todayData = stats[0]?.todayStats[0] || {
    todayLeads: 0,
    todaySpend: 0,
    todayEntries: 0,
  };
  const allTimeData = stats[0]?.allTimeStats[0] || {
    totalEntries: 0,
    activeClients: 0,
  };

  res.status(200).json({
    success: true,
    data: {
      todayLeads: todayData.todayLeads || 0,
      todaySpend: todayData.todaySpend || 0,
      totalEntries: allTimeData.totalEntries || 0,
      activeClients: allTimeData.activeClients || 0,
    },
  });
});

/**
 * @desc    Get Meta lead data from the main API (with caching)
 * @route   GET /api/daily-entries/meta-lead/:clientId/:date
 * @access  Private
 */
export const getMetaLeadData = asyncHandler(async (req, res) => {
  const { clientId, date } = req.params;

  try {
    let leads;

    // Check cache first
    if (isCacheValid("leads")) {
      leads = getCache("leads");
    } else {
      // Fetch leads from the main API with timeout
      const response = await fetchWithTimeout(
        `${MAIN_API_URL}/api/leads`,
        {},
        15000,
      );

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch leads from main API",
        });
      }

      leads = await response.json();
      setCache("leads", leads);
    }

    // Find lead document by clientId and date
    const leadDoc = leads.find(
      (lead) => lead.clientId === clientId && lead.date === date,
    );

    if (!leadDoc) {
      return res.status(404).json({
        success: false,
        message:
          "No Meta lead data found for this client and date. Please run Meta Sync first.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        metaForm: leadDoc.metaFormLead || 0,
        metaWhatsapp: leadDoc.metaWhatsappLead || 0,
        metaFund: leadDoc.metaFund || 0,
        metaCPL: leadDoc.metaCpl || 0,
        googleCall: leadDoc.googleCallLead || 0,
        googleWebsite: leadDoc.googleWebsiteLead || 0,
        googleFund: leadDoc.googleFund || 0,
        googleCPL: leadDoc.googleCpl || 0,
        clientName: leadDoc.clientName || "",
        syncedAt: leadDoc.updatedAt || leadDoc.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch Meta lead data: ${error.message}`,
    });
  }
});

/**
 * @desc    Get fund entry data from the main API (with caching)
 * @route   GET /api/daily-entries/meta-fund/:clientId/:date
 * @access  Private
 */
export const getMetaFundData = asyncHandler(async (req, res) => {
  const { clientId, date } = req.params;

  try {
    let funds;

    // Check cache first
    if (isCacheValid("funds")) {
      funds = getCache("funds");
    } else {
      // Fetch funds from the main API with timeout
      const response = await fetchWithTimeout(
        `${MAIN_API_URL}/api/funds`,
        {},
        15000,
      );

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch funds from main API",
        });
      }

      funds = await response.json();
      setCache("funds", funds);
    }

    // Find fund entry by clientId and date
    // clientId in funds is an object with _id field
    const fundDoc = funds.find((fund) => {
      const fundClientId = fund.clientId?._id || fund.clientId;
      return fundClientId === clientId && fund.date === date;
    });

    if (!fundDoc) {
      return res.status(404).json({
        success: false,
        message: "No fund data found for this client and date.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        metaBalance: fundDoc.metaBalance || 0,
        googleBalance: fundDoc.googleBalance || 0,
        metaAmount: fundDoc.metaAmount || 0,
        googleAmount: fundDoc.googleAmount || 0,
        metaPaymentMode: fundDoc.metaPaymentMode || "",
        googlePaymentMode: fundDoc.googlePaymentMode || "",
        metaPaymentDetails: fundDoc.metaPaymentDetails || "",
        googlePaymentDetails: fundDoc.googlePaymentDetails || "",
        fundAdded: fundDoc.fundAdded || false,
        syncedAt: fundDoc.updatedAt || fundDoc.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch fund data: ${error.message}`,
    });
  }
});

/**
 * @desc    Trigger Meta sync for today via CRM_AsdManager API
 * @route   POST /api/daily-entries/sync-meta
 * @access  Private
 */
export const triggerMetaSync = asyncHandler(async (req, res) => {
  const META_SYNC_URL =
    process.env.META_SYNC_API_URL ||
    "https://crmasdmanager20260420165826-b5eefne4ghf2e7b7.canadacentral-01.azurewebsites.net";

  try {
    const response = await fetchWithTimeout(
      `${META_SYNC_URL}/api/meta-sync/today`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
      60000,
    ); // 60 second timeout for sync operations

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        message: `Meta sync failed: ${errorText}`,
      });
    }

    const result = await response.json();

    // Clear cache after successful sync to ensure fresh data
    clearCache();

    res.status(200).json({
      success: true,
      message: "Meta sync completed successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to trigger Meta sync: ${error.message}`,
    });
  }
});

/**
 * @desc    Get all clients from the main API (with caching)
 * @route   GET /api/daily-entries/main-clients
 * @access  Private
 */
export const getMainApiClients = asyncHandler(async (req, res) => {
  try {
    let clients;

    // Check cache first
    if (isCacheValid("clients")) {
      clients = getCache("clients");
    } else {
      const response = await fetchWithTimeout(
        `${MAIN_API_URL}/api/clients`,
        {},
        15000,
      );

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch clients from main API",
        });
      }

      clients = await response.json();
      setCache("clients", clients);
    }

    res.status(200).json({
      success: true,
      data: clients.map((client) => ({
        _id: client._id,
        clientName: client.clientName,
        accountID: client.accountID || client.accountId,
        customerID: client.customerID,
        status: client.status,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch clients: ${error.message}`,
    });
  }
});

/**
 * @desc    Get all leads from the main API for a specific date (with caching)
 * @route   GET /api/daily-entries/main-leads/:date
 * @access  Private
 */
export const getMainApiLeadsByDate = asyncHandler(async (req, res) => {
  const { date } = req.params;

  try {
    let leads;

    // Check cache first
    if (isCacheValid("leads")) {
      leads = getCache("leads");
    } else {
      const response = await fetchWithTimeout(
        `${MAIN_API_URL}/api/leads`,
        {},
        15000,
      );

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch leads from main API",
        });
      }

      leads = await response.json();
      setCache("leads", leads);
    }

    // Filter leads for the specified date
    const filteredLeads = leads.filter((lead) => lead.date === date);

    res.status(200).json({
      success: true,
      data: filteredLeads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch leads: ${error.message}`,
    });
  }
});

/**
 * @desc    Get all funds from the main API for a specific date (with caching)
 * @route   GET /api/daily-entries/main-funds/:date
 * @access  Private
 */
export const getMainApiFundsByDate = asyncHandler(async (req, res) => {
  const { date } = req.params;

  try {
    let funds;

    // Check cache first
    if (isCacheValid("funds")) {
      funds = getCache("funds");
    } else {
      const response = await fetchWithTimeout(
        `${MAIN_API_URL}/api/funds`,
        {},
        15000,
      );

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          message: "Failed to fetch funds from main API",
        });
      }

      funds = await response.json();
      setCache("funds", funds);
    }

    // Filter funds for the specified date
    const filteredFunds = funds.filter((fund) => fund.date === date);

    res.status(200).json({
      success: true,
      data: filteredFunds.map((fund) => ({
        ...fund,
        clientId: fund.clientId?._id || fund.clientId,
        clientName: fund.clientId?.clientName || "",
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch funds: ${error.message}`,
    });
  }
});
