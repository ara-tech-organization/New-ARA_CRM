import express from 'express';
import {
  getDashboardOverview,
  getSalesReport,
  getCampaignPerformanceReport,
  getLeadPerformanceReport,
  getUserPerformanceReport,
  getFinancialReport,
} from '../controllers/reportsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { dateRangeValidation } from '../utils/validators.js';
import { checkPermission, PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes are protected
router.use(protect);
router.use(checkPermission(PERMISSIONS.REPORT_VIEW));

router.get('/dashboard', dateRangeValidation, validate, getDashboardOverview);
router.get('/sales', dateRangeValidation, validate, getSalesReport);
router.get('/campaign-performance', dateRangeValidation, validate, getCampaignPerformanceReport);
router.get('/lead-performance', dateRangeValidation, validate, getLeadPerformanceReport);
router.get('/user-performance', authorize('superadmin', 'admin'), dateRangeValidation, validate, getUserPerformanceReport);
router.get('/financial', authorize('superadmin', 'admin'), dateRangeValidation, validate, getFinancialReport);

export default router;
