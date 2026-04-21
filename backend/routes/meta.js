// Phase 3 admin routes for Meta sync. Webhook + config endpoints land in
// Phase 4. No auth middleware here — matches the existing /api/google-ads
// pattern; a global auth pass can be added later.

import express from 'express';
import {
  postSyncAll,
  postSyncClient,
  postSyncAdAccount,
  getStatus,
  getRuns,
  getHealth,
  getVerifyAdAccount,
  getWebhook,
  postWebhook,
  getUnassignedForms,
  postAssignForm,
  postReprocessForm,
  getRetryQueue,
  getRawLeads,
} from '../controllers/metaController.js';

const router = express.Router();

// Webhook (public — authenticated via X-Hub-Signature-256 on POST)
router.get('/webhook', getWebhook);
router.post('/webhook', postWebhook);

// Observability / admin
router.get('/health', getHealth);
router.get('/sync-status', getStatus);
router.get('/sync-runs', getRuns);
router.get('/retry-queue', getRetryQueue);
router.get('/raw-leads', getRawLeads);

// Sync triggers
router.post('/sync', postSyncAll);
router.post('/sync/:clientId', postSyncClient);
router.post('/sync/ad-account/:adAccountId', postSyncAdAccount);

// Forms admin
router.get('/unassigned-forms', getUnassignedForms);
router.post('/forms/:formId/assign', postAssignForm);
router.post('/forms/:formId/reprocess', postReprocessForm);

// Utilities
router.get('/ad-account/:adAccountId/verify', getVerifyAdAccount);

export default router;
