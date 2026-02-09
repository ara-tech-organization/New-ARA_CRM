import express from 'express';
import {
  getDailyLeadData,
  getDailyLeadDataById,
  getDailyLeadDataByDate,
  createDailyLeadData,
  updateDailyLeadData,
  deleteDailyLeadData,
  getDailyLeadDataStats,
  getCampaignComparison,
} from '../controllers/dailyLeadDataController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { dailyLeadDataValidation, idValidation, paginationValidation, dateRangeValidation } from '../utils/validators.js';
import { checkPermission, PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .get(paginationValidation, dateRangeValidation, validate, checkPermission(PERMISSIONS.ENTRY_READ), getDailyLeadData)
  .post(dailyLeadDataValidation, validate, checkPermission(PERMISSIONS.ENTRY_CREATE), createDailyLeadData);

router.get('/stats/summary', dateRangeValidation, validate, checkPermission(PERMISSIONS.REPORT_VIEW), getDailyLeadDataStats);
router.get('/stats/campaign-comparison', dateRangeValidation, validate, checkPermission(PERMISSIONS.REPORT_VIEW), getCampaignComparison);
router.get('/date/:date', checkPermission(PERMISSIONS.ENTRY_READ), getDailyLeadDataByDate);

router.route('/:id')
  .get(idValidation, validate, checkPermission(PERMISSIONS.ENTRY_READ), getDailyLeadDataById)
  .put(idValidation, dailyLeadDataValidation, validate, checkPermission(PERMISSIONS.ENTRY_UPDATE), updateDailyLeadData)
  .delete(idValidation, validate, checkPermission(PERMISSIONS.ENTRY_DELETE), deleteDailyLeadData);

export default router;
