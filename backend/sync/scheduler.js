import cron from 'node-cron';
import syncService from './syncService.js';

// How often the background sync runs. Override via SYNC_INTERVAL_MINUTES.
const SYNC_INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 15;

// Delay before the first startup sync runs, so the server can finish booting
// and accepting traffic before we pin CPU/network on Google Ads calls.
const STARTUP_DELAY_MS = 30 * 1000;

// Overlap guard — if a sync is still running when the next tick fires, skip it.
let syncInProgress = false;
let lastRunAt = null;
let lastRunDurationMs = null;
let lastRunError = null;

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
