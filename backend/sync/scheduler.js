import cron from 'node-cron';
import syncService from './syncService.js';
import { syncAllMetaClients } from './metaSyncService.js';
import { processRetries } from '../services/metaLeadService.js';

// How often the background sync runs. Override via SYNC_INTERVAL_MINUTES.
const SYNC_INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 15;

// Meta runs on its own cadence; can stagger or match Google.
const META_SYNC_INTERVAL_MINUTES =
  parseInt(process.env.META_SYNC_INTERVAL_MINUTES, 10) || 15;
const META_SYNC_ENABLED = (process.env.META_SYNC_ENABLED || 'true').toLowerCase() !== 'false';

// Delay before the first startup sync runs, so the server can finish booting
// and accepting traffic before we pin CPU/network on Google Ads calls.
const STARTUP_DELAY_MS = 30 * 1000;
const META_STARTUP_DELAY_MS = 45 * 1000;

// Overlap guard — if a sync is still running when the next tick fires, skip it.
let syncInProgress = false;
let lastRunAt = null;
let lastRunDurationMs = null;
let lastRunError = null;

// Separate Meta run state so Google and Meta can run independently.
let metaSyncInProgress = false;
let metaLastRunAt = null;
let metaLastRunDurationMs = null;
let metaLastRunError = null;
let metaLastRunStatus = null;
let metaLastRunId = null;
let metaLastRunCounts = null;

async function runSyncOnce(trigger) {
  if (syncInProgress) {
    console.log(`[sync-scheduler] ${trigger}: previous run still in progress — skipping`);
    return;
  }
  syncInProgress = true;
  const startedAt = Date.now();
  console.log(`[sync-scheduler] ${trigger}: starting syncAllClients()`);
  try {
    await syncService.syncAllClients();
    lastRunError = null;
  } catch (err) {
    lastRunError = err?.message || String(err);
    console.error(`[sync-scheduler] ${trigger}: sync failed —`, err);
  } finally {
    lastRunDurationMs = Date.now() - startedAt;
    lastRunAt = new Date();
    syncInProgress = false;
    console.log(
      `[sync-scheduler] ${trigger}: finished in ${lastRunDurationMs}ms at ${lastRunAt.toISOString()}`
    );
  }
}

export function startSyncScheduler() {
  const cronExpr = `*/${SYNC_INTERVAL_MINUTES} * * * *`;
  if (!cron.validate(cronExpr)) {
    console.error(`[sync-scheduler] invalid cron expression "${cronExpr}" — scheduler disabled`);
    return;
  }

  cron.schedule(cronExpr, () => {
    runSyncOnce('cron-tick').catch(() => {});
  });

  setTimeout(() => {
    runSyncOnce('startup').catch(() => {});
  }, STARTUP_DELAY_MS);

  console.log(
    `[sync-scheduler] scheduled every ${SYNC_INTERVAL_MINUTES} min (cron: "${cronExpr}"); initial run in ${STARTUP_DELAY_MS / 1000}s`
  );

  startMetaSyncScheduler();
}

async function runMetaSyncOnce(trigger) {
  if (!META_SYNC_ENABLED) return;
  if (metaSyncInProgress) {
    console.log(`[meta-scheduler] ${trigger}: previous run still in progress — skipping`);
    return;
  }
  metaSyncInProgress = true;
  const startedAt = Date.now();
  console.log(`[meta-scheduler] ${trigger}: starting syncAllMetaClients()`);
  try {
    const run = await syncAllMetaClients();
    metaLastRunError = run?.errors?.length
      ? run.errors[run.errors.length - 1].message
      : null;
    metaLastRunStatus = run?.status || 'unknown';
    metaLastRunId = run?.run_id || null;
    metaLastRunCounts = run?.counts || null;
  } catch (err) {
    metaLastRunError = err?.message || String(err);
    metaLastRunStatus = 'failed';
    console.error(`[meta-scheduler] ${trigger}: sync failed —`, err);
  } finally {
    metaLastRunDurationMs = Date.now() - startedAt;
    metaLastRunAt = new Date();
    metaSyncInProgress = false;
    console.log(
      `[meta-scheduler] ${trigger}: finished in ${metaLastRunDurationMs}ms at ${metaLastRunAt.toISOString()} status=${metaLastRunStatus}`
    );
  }
}

export function startMetaSyncScheduler() {
  if (!META_SYNC_ENABLED) {
    console.log('[meta-scheduler] disabled via META_SYNC_ENABLED=false');
    return;
  }

  // Offset from Google's minute marks to reduce API/DB contention.
  const cronExpr = `5-59/${META_SYNC_INTERVAL_MINUTES} * * * *`;
  if (!cron.validate(cronExpr)) {
    console.error(`[meta-scheduler] invalid cron expression "${cronExpr}" — scheduler disabled`);
    return;
  }

  cron.schedule(cronExpr, () => {
    runMetaSyncOnce('cron-tick').catch(() => {});
  });

  setTimeout(() => {
    runMetaSyncOnce('startup').catch(() => {});
  }, META_STARTUP_DELAY_MS);

  console.log(
    `[meta-scheduler] scheduled every ${META_SYNC_INTERVAL_MINUTES} min (cron: "${cronExpr}"); initial run in ${META_STARTUP_DELAY_MS / 1000}s`
  );

  // Retry worker for failed webhook deliveries — runs every 2 min.
  let retryInProgress = false;
  cron.schedule('*/2 * * * *', async () => {
    if (retryInProgress) return;
    retryInProgress = true;
    try {
      const summary = await processRetries();
      if (summary.processed > 0) {
        console.log(
          `[meta-retry] processed=${summary.processed} resolved=${summary.resolved} ` +
          `requeued=${summary.requeued} abandoned=${summary.abandoned}`
        );
      }
    } catch (err) {
      console.error('[meta-retry] worker crashed:', err?.message || err);
    } finally {
      retryInProgress = false;
    }
  });
  console.log('[meta-retry] worker scheduled every 2 min');
}

export function triggerMetaSyncNow() {
  return runMetaSyncOnce('manual');
}

export function getMetaSyncStatus() {
  return {
    enabled: META_SYNC_ENABLED,
    syncInProgress: metaSyncInProgress,
    lastRunAt: metaLastRunAt,
    lastRunDurationMs: metaLastRunDurationMs,
    lastRunError: metaLastRunError,
    lastRunStatus: metaLastRunStatus,
    lastRunId: metaLastRunId,
    lastRunCounts: metaLastRunCounts,
    intervalMinutes: META_SYNC_INTERVAL_MINUTES,
  };
}

// Fire-and-forget single-client sync (used when a client is newly linked,
// so their details page has data as soon as possible without the HTTP request
// having to block on Google Ads).
export function triggerClientSync(clientId) {
  syncService.manualSync(clientId).catch(err =>
    console.error(`[sync-scheduler] client sync failed (clientId=${clientId}):`, err)
  );
}

export function getSyncStatus() {
  return {
    syncInProgress,
    lastRunAt,
    lastRunDurationMs,
    lastRunError,
    intervalMinutes: SYNC_INTERVAL_MINUTES,
  };
}
