import express from 'express';
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import Metric from '../models/Metric.js';
import BillingTransaction from '../models/BillingTransaction.js';
import DailyDebitSnapshot from '../models/DailyDebitSnapshot.js';
import syncService from '../sync/syncService.js';

const router = express.Router();

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * POST /api/billing/:clientId/reconcile
 *
 * Reconcile CRM billing with Google Ads UI-displayed balance.
 *
 * Flow:
 *   1. (Optional) Deep sync: pull full spend history since client.onboardDate
 *      so the ledger has every rupee of spend.
 *   2. Read current CRM ledger totals (from BillingTransaction).
 *   3. Compute implied total payments = google_ads_balance + total_spend.
 *   4. gap = implied_total_payments - total_payments_in_crm
 *   5. If |gap| >= 0.01, insert an `admin_adjustment` ledger row for the gap
 *      and update Client.billing cache.
 *
 * Body:
 *   {
 *     "google_ads_balance": 5815.72,  // required — current balance shown in Google Ads UI
 *     "skip_deep_sync": false,        // optional — skip the deep-sync step
 *     "notes": "Reconciled from GA UI 2026-04-17"  // optional
 *   }
 *
 * Response: the full reconciliation summary.
 */
router.post('/:clientId/reconcile', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { google_ads_balance, skip_deep_sync, notes } = req.body;

    if (google_ads_balance === undefined || google_ads_balance === null) {
      return res.status(400).json({
        error: 'google_ads_balance is required (enter the current "Available funds" value from the Google Ads billing page)'
      });
    }

    const googleAdsBalance = round2(google_ads_balance);
    if (!Number.isFinite(googleAdsBalance)) {
      return res.status(400).json({ error: 'google_ads_balance must be a number' });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Step 1: Deep sync to catch missing historical spend
    if (!skip_deep_sync) {
      if (!client.google_ads_enabled || !client.google_ads_customer_id) {
        return res.status(400).json({
          error: 'Client does not have Google Ads enabled; pass skip_deep_sync=true to reconcile without syncing'
        });
      }
      console.log(`Reconcile: deep-syncing client ${client.clientName}...`);
      await syncService.manualSync(clientId, { deep: true });
    }

    // Step 2: Read ledger totals
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const totals = await BillingTransaction.aggregate([
      { $match: { client_id: clientObjectId } },
      {
        $group: {
          _id: null,
          credits: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
          debits:  { $sum: { $cond: [{ $eq: ['$type', 'debit'] },  '$amount', 0] } },
          // Adjustments can be positive or negative; track separately.
          adjustments: { $sum: { $cond: [{ $eq: ['$type', 'adjustment'] }, '$amount', 0] } }
        }
      }
    ]);

    const totalCredits = round2(totals[0]?.credits);
    const totalDebits = round2(totals[0]?.debits);
    const totalAdjustments = round2(totals[0]?.adjustments);
    const ledgerBalance = round2(totalCredits + totalAdjustments - totalDebits);

    // Step 3: Implied total payments (what we *should* have recorded as credits+adjustments)
    //   google_ads_balance = implied_credits_and_adjustments - total_debits
    //   implied_credits_and_adjustments = google_ads_balance + total_debits
    const impliedCreditsAdjustments = round2(googleAdsBalance + totalDebits);
    const currentCreditsAdjustments = round2(totalCredits + totalAdjustments);
    const gap = round2(impliedCreditsAdjustments - currentCreditsAdjustments);

    // Step 4: Insert adjustment row if needed
    let adjustmentCreated = null;

    if (Math.abs(gap) >= 0.01) {
      const isPositive = gap > 0;
      const absAmount = round2(Math.abs(gap));

      // Positive gap = we missed payments → also bump total_added_funds so
      // the lifetime-funds cache stays meaningful.
      // Negative gap = we over-credited → reduce total_added_funds.
      const cacheInc = {
        'billing.available_balance': gap,
        'billing.total_added_funds': gap
      };

      const updatedClient = await Client.findByIdAndUpdate(
        clientId,
        { $inc: cacheInc },
        { new: true }
      );

      const newBalance = round2(updatedClient?.billing?.available_balance);

      try {
        adjustmentCreated = await BillingTransaction.create({
          client_id: clientId,
          type: 'adjustment',
          amount: absAmount,
          balance_after: newBalance,
          occurred_at: new Date(),
          source: 'admin_adjustment',
          reference: {},
          description:
            (notes && notes.trim()) ||
            `Reconciled with Google Ads (balance: ${googleAdsBalance.toFixed(2)}). ${isPositive ? 'Added missing payments' : 'Removed excess payments'}: ${absAmount.toFixed(2)}`
        });
      } catch (err) {
        // Roll back the cache inc on failure
        await Client.findByIdAndUpdate(clientId, {
          $inc: {
            'billing.available_balance': -gap,
            'billing.total_added_funds': -gap
          }
        });
        throw err;
      }
    } else {
      // No gap -- just refresh the cache to match ledger (keeps cache honest)
      await Client.findByIdAndUpdate(clientId, {
        'billing.available_balance': googleAdsBalance
      });
    }

    // Step 5: Return a full summary
    const finalClient = await Client.findById(clientId).select('billing');

    res.json({
      message: Math.abs(gap) >= 0.01
        ? `Reconciled. Adjustment of ${gap >= 0 ? '+' : ''}${gap.toFixed(2)} inserted.`
        : 'Already in sync with Google Ads — no adjustment needed.',
      reconciliation: {
        google_ads_balance: googleAdsBalance,
        ledger_before: {
          total_credits: totalCredits,
          total_debits: totalDebits,
          total_adjustments: totalAdjustments,
          balance: ledgerBalance
        },
        gap_detected: gap,
        adjustment_inserted: adjustmentCreated
          ? {
              id: adjustmentCreated._id,
              amount: gap,
              type: 'adjustment',
              occurred_at: adjustmentCreated.occurred_at
            }
          : null,
        ledger_after: {
          available_balance: round2(finalClient?.billing?.available_balance),
          total_spend: round2(finalClient?.billing?.total_spend),
          total_added_funds: round2(finalClient?.billing?.total_added_funds)
        },
        deep_sync_ran: !skip_deep_sync
      }
    });
  } catch (error) {
    console.error('Reconcile error:', error);
    res.status(500).json({ error: error.message || 'Failed to reconcile billing' });
  }
});

/**
 * POST /api/billing/:clientId/deep-sync
 *
 * Trigger a full-history metric pull from Google Ads (since client.onboardDate)
 * and reconcile the ledger for all historical days. Useful for the first-run
 * backfill or to catch up after long downtime.
 */
router.post('/:clientId/deep-sync', async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.google_ads_enabled || !client.google_ads_customer_id) {
      return res.status(400).json({ error: 'Client does not have Google Ads enabled' });
    }

    await syncService.manualSync(clientId, { deep: true });

    const updated = await Client.findById(clientId).select('billing');
    res.json({
      message: 'Deep sync completed.',
      billing: {
        available_balance: round2(updated?.billing?.available_balance),
        total_spend: round2(updated?.billing?.total_spend),
        total_added_funds: round2(updated?.billing?.total_added_funds)
      }
    });
  } catch (error) {
    console.error('Deep sync error:', error);
    res.status(500).json({ error: error.message || 'Deep sync failed' });
  }
});

/**
 * POST /api/billing/:clientId/reset
 *
 * DESTRUCTIVE — Wipes the client's billing ledger and starts fresh.
 *
 * Use when:
 *   - Legacy client has messy / negative balance from old syncs.
 *   - You want to start tracking from a specific date with a known opening
 *     balance (what Google Ads UI shows right now), ignoring all prior history.
 *
 * Effects:
 *   1. Deletes ALL BillingTransaction rows for this client.
 *   2. Deletes ALL DailyDebitSnapshot rows for this client.
 *   3. Sets client.onboardDate = start_date (so future syncs don't pull
 *      pre-start_date data).
 *   4. Resets client.billing cache: available_balance = opening_balance,
 *      total_spend = 0, total_added_funds = 0.
 *   5. Inserts ONE opening-balance `adjustment` ledger row.
 *
 * Legacy Payment and Metric collection rows are NOT deleted (they may be
 * useful for historical reporting outside the ledger).
 *
 * Body:
 *   {
 *     "opening_balance": 5815.72,      // required — current GA "available funds"
 *     "start_date": "2026-04-17",      // optional — defaults to today
 *     "notes": "Fresh start ...",      // optional
 *     "confirm": true                  // REQUIRED — must be literally true
 *   }
 */
router.post('/:clientId/reset', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { opening_balance, start_date, notes, confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({
        error: 'This is a destructive operation. Pass "confirm": true to proceed.'
      });
    }

    if (opening_balance === undefined || opening_balance === null) {
      return res.status(400).json({
        error: 'opening_balance is required (current "Available funds" value from Google Ads billing page)'
      });
    }

    const openingBalance = round2(opening_balance);
    if (!Number.isFinite(openingBalance)) {
      return res.status(400).json({ error: 'opening_balance must be a number' });
    }

    let startDate = new Date();
    if (start_date) {
      const parsed = new Date(start_date);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Invalid start_date' });
      }
      startDate = parsed;
    }
    startDate.setUTCHours(0, 0, 0, 0);

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    // Step 1 & 2: Wipe ledger + snapshots
    const deletedTx = await BillingTransaction.deleteMany({ client_id: clientId });
    const deletedSnap = await DailyDebitSnapshot.deleteMany({ client_id: clientId });

    // Step 3: Move onboardDate forward so future syncs start here
    // Step 4: Reset cache
    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      {
        onboardDate: startDate,
        'billing.available_balance': openingBalance,
        'billing.total_spend': 0,
        'billing.total_added_funds': 0
      },
      { new: true }
    );

    // Step 5: Insert opening-balance adjustment row
    const openingRow = await BillingTransaction.create({
      client_id: clientId,
      type: 'adjustment',
      amount: Math.abs(openingBalance),
      balance_after: openingBalance,
      occurred_at: startDate,
      source: 'admin_adjustment',
      reference: {},
      description:
        (notes && notes.trim()) ||
        `Opening balance on reset (from Google Ads UI): ${openingBalance.toFixed(2)}`
    });

    // Step 6: Mark existing post-start_date Metric rows as "already accounted
    //         for" in the opening balance. The GA UI balance the admin enters
    //         already reflects today's spend-so-far, so we must NOT let the
    //         next sync debit it again. We do this by creating snapshots with
    //         debited_amount = reported_amount → next sync delta = 0.
    const existingMetrics = await Metric.find({
      client_id: clientId,
      date: { $gte: startDate }
    });

    let snapshotsCreated = 0;
    if (existingMetrics.length > 0) {
      const snapshotDocs = existingMetrics.map(m => {
        const dateKey = new Date(m.date);
        dateKey.setUTCHours(0, 0, 0, 0);
        const reported = round2(m.cost);
        return {
          client_id: clientId,
          campaign_id: m.campaign_id,
          date: dateKey,
          debited_amount: reported,
          reported_amount: reported,
          last_synced_at: new Date()
        };
      });
      const result = await DailyDebitSnapshot.insertMany(snapshotDocs, {
        ordered: false
      });
      snapshotsCreated = result.length;
    }

    res.json({
      message: 'Client billing reset successfully. Tracking begins from start_date.',
      reset: {
        cleared_transactions: deletedTx.deletedCount,
        cleared_snapshots: deletedSnap.deletedCount,
        new_onboard_date: startDate.toISOString().slice(0, 10),
        opening_balance: openingBalance,
        opening_ledger_row_id: openingRow._id,
        existing_metrics_marked_as_accounted: snapshotsCreated
      },
      client: {
        clientId: updatedClient._id,
        clientName: updatedClient.clientName,
        onboardDate: updatedClient.onboardDate,
        billing: updatedClient.billing
      }
    });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset billing' });
  }
});

export default router;
