import express from 'express';
import { analyzeCampaign } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Agency-side authenticated: AI analysis exposes strategic commentary
// on client performance and should never be reachable without a valid
// agency session.
router.use(protect);

// POST /api/ai/analyze-campaign
// Body: { platform, clientName, dateRange: { from, to }, summary, campaigns }
router.post('/analyze-campaign', analyzeCampaign);

export default router;
