import express from 'express';
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  getLeadStats,
  getMonthlyMetaByClient,
  getDailyByClient,
} from '../controllers/leadController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { leadValidation, idValidation, paginationValidation } from '../utils/validators.js';
import { checkPermission, PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .get(paginationValidation, validate, checkPermission(PERMISSIONS.LEAD_READ), getLeads)
  .post(leadValidation, validate, checkPermission(PERMISSIONS.LEAD_CREATE), createLead);

router.get('/stats/summary', checkPermission(PERMISSIONS.LEAD_READ), getLeadStats);
router.get('/monthly-meta-by-client', checkPermission(PERMISSIONS.LEAD_READ), getMonthlyMetaByClient);
router.get('/daily-by-client', checkPermission(PERMISSIONS.LEAD_READ), getDailyByClient);

router.route('/:id')
  .get(idValidation, validate, checkPermission(PERMISSIONS.LEAD_READ), getLead)
  .put(idValidation, leadValidation, validate, checkPermission(PERMISSIONS.LEAD_UPDATE), updateLead)
  .delete(idValidation, validate, checkPermission(PERMISSIONS.LEAD_DELETE), deleteLead);

export default router;
