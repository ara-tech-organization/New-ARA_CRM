import express from 'express';
import {
  getFundEntries,
  getFundEntry,
  createFundEntry,
  updateFundEntry,
  deleteFundEntry,
  approveFundEntry,
  getFundEntryStats,
  getFundEntriesByClient,
} from '../controllers/fundEntryController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { fundEntryValidation, idValidation, paginationValidation, dateRangeValidation } from '../utils/validators.js';
import { checkPermission, PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .get(paginationValidation, dateRangeValidation, validate, checkPermission(PERMISSIONS.FUND_READ), getFundEntries)
  .post(fundEntryValidation, validate, checkPermission(PERMISSIONS.FUND_CREATE), createFundEntry);

router.get('/stats/summary', dateRangeValidation, validate, checkPermission(PERMISSIONS.FUND_READ), getFundEntryStats);
router.get('/client/:clientId', idValidation, validate, checkPermission(PERMISSIONS.FUND_READ), getFundEntriesByClient);

router.route('/:id')
  .get(idValidation, validate, checkPermission(PERMISSIONS.FUND_READ), getFundEntry)
  .put(idValidation, fundEntryValidation, validate, checkPermission(PERMISSIONS.FUND_UPDATE), updateFundEntry)
  .delete(idValidation, validate, checkPermission(PERMISSIONS.FUND_DELETE), deleteFundEntry);

router.patch('/:id/approve', idValidation, validate, authorize('superadmin', 'admin'), approveFundEntry);

export default router;
