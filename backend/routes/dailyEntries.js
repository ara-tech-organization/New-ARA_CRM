import express from 'express';
import {
  getDailyEntries,
  getDailyEntry,
  getDailyEntryByDate,
  createDailyEntry,
  updateDailyEntry,
  deleteDailyEntry,
  getDailyEntryStats,
  getTodayStats,
  getMetaLeadData,
  getMetaFundData,
  triggerMetaSync,
  getMainApiClients,
  getMainApiLeadsByDate,
  getMainApiFundsByDate,
} from '../controllers/dailyEntryController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { idValidation, paginationValidation, dateRangeValidation } from '../utils/validators.js';
import { checkPermission, PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .get(paginationValidation, dateRangeValidation, validate, checkPermission(PERMISSIONS.ENTRY_READ), getDailyEntries)
  .post(checkPermission(PERMISSIONS.ENTRY_CREATE), createDailyEntry);

router.get('/stats/summary', dateRangeValidation, validate, checkPermission(PERMISSIONS.ENTRY_READ), getDailyEntryStats);
router.get('/stats/today', checkPermission(PERMISSIONS.ENTRY_READ), getTodayStats);
router.get('/date/:date', checkPermission(PERMISSIONS.ENTRY_READ), getDailyEntryByDate);

// Meta sync endpoints
router.get('/meta-lead/:clientId/:date', checkPermission(PERMISSIONS.ENTRY_READ), getMetaLeadData);
router.get('/meta-fund/:clientId/:date', checkPermission(PERMISSIONS.ENTRY_READ), getMetaFundData);
router.post('/sync-meta', checkPermission(PERMISSIONS.ENTRY_CREATE), triggerMetaSync);

// Main API fetch endpoints
router.get('/main-clients', checkPermission(PERMISSIONS.ENTRY_READ), getMainApiClients);
router.get('/main-leads/:date', checkPermission(PERMISSIONS.ENTRY_READ), getMainApiLeadsByDate);
router.get('/main-funds/:date', checkPermission(PERMISSIONS.ENTRY_READ), getMainApiFundsByDate);

router.route('/:id')
  .get(idValidation, validate, checkPermission(PERMISSIONS.ENTRY_READ), getDailyEntry)
  .put(idValidation, validate, checkPermission(PERMISSIONS.ENTRY_UPDATE), updateDailyEntry)
  .delete(idValidation, validate, checkPermission(PERMISSIONS.ENTRY_DELETE), deleteDailyEntry);

export default router;
