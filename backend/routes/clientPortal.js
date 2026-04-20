import express from 'express';
import { protectClient } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * @desc    Get analytics for the authenticated client (their own data only)
 * @route   GET /api/client-portal/analytics
 * @access  Private (client portal)
 */
router.get('/analytics', protectClient, asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  const clientId = req.clientId;

  // Forward to the same analytics endpoint used by admin
  // Import the analytics controller or call the internal API
  const axios = (await import('axios')).default;
  const baseUrl = process.env.MAIN_API_URL || `http://localhost:${process.env.PORT || 5000}`;

  try {
    const response = await axios.get(`${baseUrl}/api/analytics/client/${clientId}`, {
      params: { start_date, end_date },
      headers: { Authorization: req.headers.authorization },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: 'Failed to fetch analytics' };
    res.status(status).json(data);
  }
}));

export default router;
