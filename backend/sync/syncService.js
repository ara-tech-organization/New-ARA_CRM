import cron from 'node-cron';
import Client from '../models/Client.js';
import Campaign from '../models/Campaign.js';
import Metric from '../models/Metric.js';
import BillingTransaction from '../models/BillingTransaction.js';
import DailyDebitSnapshot from '../models/DailyDebitSnapshot.js';
import googleAdsService from '../services/googleAdsService.js';
import analyticsService from '../services/analyticsService.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function startOfUtcDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

class SyncService {
  constructor() {
    // Schedule to run every 15 minutes for near real-time data updates
    cron.schedule('*/15 * * * *', () => {
      console.log('Starting Google Ads sync...');
      this.syncAllClients();
    });
  }

  async syncAllClients() {
    try {
      const clients = await Client.find({
        google_ads_customer_id: { $ne: '', $exists: true },
        google_ads_enabled: true
      });

      for (const client of clients) {
        await this.syncClient(client);
      }

      console.log('Sync completed for all clients');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  async syncClient(client, options = {}) {
    try {
      const { deep = false } = options;

      console.log(
        `Syncing client: ${client.clientName} (${client.google_ads_customer_id})${deep ? ' [DEEP]' : ''}`
      );

      // 1. Fetch and store campaigns
      const campaigns = await googleAdsService.fetchCampaigns(client.google_ads_customer_id);
      const campaignMap = {};
      for (const campaignData of campaigns) {
        campaignMap[campaignData.campaign_id] = campaignData.name;
        await Campaign.findOneAndUpdate(
          { campaign_id: campaignData.campaign_id },
          {
            client_id: client._id,
            ...campaignData
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      // 2. Fetch and store metrics.
      //    Never pull data from before client.onboardDate — new clients only
      //    track spend from their onboard date onwards.
      //    - Regular sync: last 30 days, floored at onboardDate
      //    - Deep sync:    onboardDate → today
      const onboardDate = client.onboardDate ? new Date(client.onboardDate) : null;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let fromDate;
      if (deep && onboardDate) {
        fromDate = onboardDate;
      } else if (onboardDate && onboardDate > thirtyDaysAgo) {
        fromDate = onboardDate;
      } else {
        fromDate = thirtyDaysAgo;
      }

      const metrics = await googleAdsService.fetchMetricsWithClicks(
        client.google_ads_customer_id,
        fromDate
      );
      for (const metricData of metrics) {
        const kpis = analyticsService.calculateKPIs(metricData);

        await Metric.findOneAndUpdate(
          {
            client_id: client._id,
            campaign_id: metricData.campaign_id,
            date: new Date(metricData.date)
          },
          {
            ...metricData,
            campaign_name: campaignMap[metricData.campaign_id] || metricData.campaign_name || 'Unknown Campaign',
            ...kpis
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      // 3. Reconcile billing ledger (delta-debit per campaign/day)
      await this.updateClientBilling(client._id, { deep });

      console.log(`Sync completed for client: ${client.clientName}`);
    } catch (error) {
      console.error(`Sync failed for client ${client.clientName}:`, error);
    }
  }

  async updateClientBilling(clientId, options = {}) {
    const { deep = false } = options;

    // Floor at onboardDate — we never reconcile pre-onboard data.
    const client = await Client.findById(clientId).select('onboardDate');
    const onboardDate = client?.onboardDate
      ? startOfUtcDay(client.onboardDate)
      : null;

    const filter = { client_id: clientId };

    if (deep) {
      if (onboardDate) filter.date = { $gte: onboardDate };
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
      thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
      const cutoff =
        onboardDate && onboardDate > thirtyDaysAgo ? onboardDate : thirtyDaysAgo;
      filter.date = { $gte: cutoff };
    }

    const metrics = await Metric.find(filter).sort({ date: 1 });

    for (const metric of metrics) {
      try {
        await this.reconcileDailyDebit(clientId, metric);
      } catch (err) {
        console.error(
          `Ledger reconcile failed (client=${clientId}, campaign=${metric.campaign_id}, date=${metric.date?.toISOString?.()}):`,
          err
        );
      }
    }
  }

  /**
   * For a single (client, campaign, day) metric row, compute the delta between
   * what Google Ads currently reports and what we've already debited, then
   * insert a ledger row for the delta (positive -> debit, negative -> refund).
   */
  async reconcileDailyDebit(clientId, metric) {
    const reportedCost = round2(metric.cost);
    const dateKey = startOfUtcDay(metric.date);

    const snapshot = await DailyDebitSnapshot.findOne({
      client_id: clientId,
      campaign_id: metric.campaign_id,
      date: dateKey
    });

    const debitedSoFar = snapshot ? round2(snapshot.debited_amount) : 0;
    const delta = round2(reportedCost - debitedSoFar);

    if (delta === 0) {
      if (snapshot) {
        snapshot.reported_amount = reportedCost;
        snapshot.last_synced_at = new Date();
        await snapshot.save();
      }
      return;
    }

    const isDebit = delta > 0;
    const absAmount = round2(Math.abs(delta));
    const balanceChange = isDebit ? -absAmount : absAmount;
    const totalSpendChange = delta;

    const updatedClient = await Client.findByIdAndUpdate(
      clientId,
      {
        $inc: {
          'billing.available_balance': balanceChange,
          'billing.total_spend': totalSpendChange
        }
      },
      { new: true }
    );

    const newBalance = round2(updatedClient?.billing?.available_balance);

    try {
      await BillingTransaction.create({
        client_id: clientId,
        type: isDebit ? 'debit' : 'credit',
        amount: absAmount,
        balance_after: newBalance,
        occurred_at: new Date(),
        source: isDebit ? 'google_ads_daily_spend' : 'google_ads_refund',
        reference: {
          campaign_id: metric.campaign_id,
          campaign_name: metric.campaign_name,
          metric_date: dateKey
        },
        description: isDebit
          ? `Google Ads spend (${metric.campaign_name}) on ${dateKey.toISOString().slice(0, 10)}`
          : `Google Ads cost revision / refund (${metric.campaign_name}) on ${dateKey.toISOString().slice(0, 10)}`
      });
    } catch (err) {
      // Roll back the cache inc to prevent drift
      await Client.findByIdAndUpdate(clientId, {
        $inc: {
          'billing.available_balance': -balanceChange,
          'billing.total_spend': -totalSpendChange
        }
      });
      throw err;
    }

    if (snapshot) {
      snapshot.debited_amount = reportedCost;
      snapshot.reported_amount = reportedCost;
      snapshot.last_synced_at = new Date();
      await snapshot.save();
    } else {
      try {
        await DailyDebitSnapshot.create({
          client_id: clientId,
          campaign_id: metric.campaign_id,
          date: dateKey,
          debited_amount: reportedCost,
          reported_amount: reportedCost,
          last_synced_at: new Date()
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
    }
  }

  // Manual trigger method for testing + deep sync from reconciliation
  async manualSync(clientId = null, options = {}) {
    if (clientId) {
      const client = await Client.findById(clientId);
      if (client) await this.syncClient(client, options);
    } else {
      await this.syncAllClients();
    }
  }
}

const syncService = new SyncService();

export default syncService;
