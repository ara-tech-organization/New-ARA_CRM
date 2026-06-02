// Meta sync routes. Used by BOTH the admin app and the client portal,
// so the auth layer accepts either token type via `protectAdminOrClient`.
// Tenant ownership is enforced inside the controller (loadClientOr404
// reads req.clientId / req.user and rejects cross-tenant access).
//
// /webhook is the one public endpoint here — Meta itself calls it with
// its own X-Hub-Signature-256 HMAC; we add it BEFORE protectAdminOrClient
// so it stays reachable. Everything else requires a valid token.

import express from "express";
import { protectAdminOrClient } from "../middleware/auth.js";
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
  createClientLead,
  deleteClientLead,
  getClientsAdsComparison,
  getTelecallingReport,
  getMonthlyAbstract,
  saveMonthlyAbstractCell,
  updateTelecallingTargets,
} from "../controllers/metaController.js";

const router = express.Router();

// Webhook (public — authenticated via X-Hub-Signature-256 on POST).
// Registered BEFORE the auth wall below so Meta's POSTs aren't rejected.
router.get("/webhook", getWebhook);
router.post("/webhook", postWebhook);

// Everything else requires a valid agency or portal JWT.
router.use(protectAdminOrClient);

// Admin-only gate for the operational/observability routes below.
// Portal tokens (set req.clientId) get a 403 — they have no business
// triggering syncs or reading the unassigned-forms queue. Per-client
// data routes further down stay accessible to portal tokens (their
// own tenant scope is enforced by loadClientOr404).
const requireAgencyToken = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ success: false, message: 'Admin-side endpoint — portal tokens not allowed.' });
  }
  next();
};

// Observability / admin — agency only
router.get("/health", requireAgencyToken, getHealth);
router.get("/sync-status", requireAgencyToken, getStatus);
router.get("/sync-runs", requireAgencyToken, getRuns);
router.post("/sync-runs/cleanup", requireAgencyToken, postCleanupSyncRuns);
router.get("/retry-queue", requireAgencyToken, getRetryQueue);
router.get("/raw-leads", requireAgencyToken, getRawLeads);

// Sync triggers — agency only
router.post("/sync", requireAgencyToken, postSyncAll);
router.post("/sync/historical", requireAgencyToken, postSyncHistorical);
router.post("/sync/historical/:clientId", requireAgencyToken, postSyncHistoricalClient);
router.post("/sync/:clientId", requireAgencyToken, postSyncClient);
router.post("/sync/ad-account/:adAccountId", requireAgencyToken, postSyncAdAccount);

// Forms admin — agency only
router.get("/unassigned-forms", requireAgencyToken, getUnassignedForms);
router.post("/forms/:formId/assign", requireAgencyToken, postAssignForm);
router.post("/forms/:formId/reprocess", requireAgencyToken, postReprocessForm);

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

// Manual lead entry — for WhatsApp / walk-in leads that don't come
// through the normal Meta lead-form sync.
router.post("/client/:clientId/leads", createClientLead);

// Delete a manual WhatsApp lead. Synced Meta-form leads are blocked
// by the controller — this endpoint only removes manual entries.
router.delete("/client/:clientId/leads/:leadId", deleteClientLead);

// EOD telecalling report — aggregates day + month metrics for the
// telecalling dashboard tab on admin and the client portal.
router.get("/client/:clientId/telecalling-report", getTelecallingReport);

// Edit the four daily/monthly targets that appear in the EOD report's
// "Target" columns. Admin + portal both call this endpoint.
router.put("/client/:clientId/telecalling-targets", updateTelecallingTargets);

// Monthly abstract — one row per date with source / call / appointment
// columns. Powers the "Monthly Abstract" view in the EOD section.
router.get("/client/:clientId/monthly-abstract", getMonthlyAbstract);

// Save a single manually-entered abstract cell (today: convert_value).
// Auto-saves on blur from the telecaller's inline editor.
router.post("/client/:clientId/monthly-abstract/cell", saveMonthlyAbstractCell);

// Utilities
router.get("/ad-account/:adAccountId/verify", getVerifyAdAccount);

export default router;
