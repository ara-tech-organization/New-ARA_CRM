// Phase 3 admin routes for Meta sync. Webhook + config endpoints land in
// Phase 4. No auth middleware here — matches the existing /api/google-ads
// pattern; a global auth pass can be added later.

import express from "express";
import {
  postSyncAll,
  postSyncClient,
  postSyncAdAccount,
  postSyncHistorical,
  postSyncHistoricalClient,
  postCleanupSyncRuns,
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
  getClientConfig,
  putClientConfig,
  postTestConnection,
  getClientAvailablePages,
  postClientSubscribePage,
  deleteClientSubscribePage,
  getClientAnalytics,
  updateClientLead,
  getClientsAdsComparison,
} from "../controllers/metaController.js";

const router = express.Router();

// Webhook (public — authenticated via X-Hub-Signature-256 on POST)
router.get("/webhook", getWebhook);
router.post("/webhook", postWebhook);

// Observability / admin
router.get("/health", getHealth);
router.get("/sync-status", getStatus);
router.get("/sync-runs", getRuns);
router.post("/sync-runs/cleanup", postCleanupSyncRuns);
router.get("/retry-queue", getRetryQueue);
router.get("/raw-leads", getRawLeads);

// Sync triggers
router.post("/sync", postSyncAll);
router.post("/sync/historical", postSyncHistorical);
router.post("/sync/historical/:clientId", postSyncHistoricalClient);
router.post("/sync/:clientId", postSyncClient);
router.post("/sync/ad-account/:adAccountId", postSyncAdAccount);

// Forms admin
router.get("/unassigned-forms", getUnassignedForms);
router.post("/forms/:formId/assign", postAssignForm);
router.post("/forms/:formId/reprocess", postReprocessForm);

// Client config + onboarding
router.get("/client/:clientId/config", getClientConfig);
router.put("/client/:clientId/config", putClientConfig);
router.post("/client/:clientId/test-connection", postTestConnection);
router.get("/client/:clientId/available-pages", getClientAvailablePages);
router.post(
  "/client/:clientId/pages/:pageId/subscribe",
  postClientSubscribePage,
);
router.delete(
  "/client/:clientId/pages/:pageId/subscribe",
  deleteClientSubscribePage,
);

// Per-client analytics (Meta-only; sibling to /api/analytics/client/:clientId for Google)
router.get("/client/:clientId/analytics", getClientAnalytics);

// Multi-client comparison — sibling to /api/analytics/clients for Google.
// Powers the Meta tab on the AdsDashboard ("Ads Comparison") page.
router.get("/clients", getClientsAdsComparison);

// Inline CRM edits from MetaLeadsTable. Reachable from both the admin
// /client-ads page and the client portal — same auth pattern as the
// analytics route above.
router.put("/client/:clientId/leads/:leadId", updateClientLead);

// Utilities
router.get("/ad-account/:adAccountId/verify", getVerifyAdAccount);

export default router;
