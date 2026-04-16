import cron from 'node-cron';
import Client from '../models/Client.js';
import Campaign from '../models/Campaign.js';
import Metric from '../models/Metric.js';
import Payment from '../models/Payment.js';
import googleAdsService from '../services/googleAdsService.js';
import analyticsService from '../services/analyticsService.js';

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

  async syncClient(client) {
    try {
      console.log(`Syncing client: ${client.clientName} (${client.google_ads_customer_id})`);

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

      // 2. Fetch and store metrics (last 30 days)
      const metrics = await googleAdsService.fetchMetricsWithClicks(client.google_ads_customer_id);
      for (const metricData of metrics) {
        // Calculate KPIs for this metric
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

      // 3. Update client billing info
      await this.updateClientBilling(client._id);

      console.log(`Sync completed for client: ${client.clientName}`);
    } catch (error) {
      console.error(`Sync failed for client ${client.clientName}:`, error);
      // Could implement retry logic here
    }
  }

  async updateClientBilling(clientId) {
    // Get the date of the most recent payment
    const latestPayment = await Payment.findOne({ client_id: clientId }).sort({ date: -1 });
    const lastPaymentDate = latestPayment ? latestPayment.date : new Date(0); // If no payments, use epoch

    // Calculate total spend from metrics after the last payment
    const totalSpendResult = await Metric.aggregate([
      { $match: { client_id: clientId, date: { $gte: lastPaymentDate } } },
      { $group: { _id: null, total: { $sum: '$cost' } } }
    ]);

    // Calculate total added funds from payments
    const totalFundsResult = await Payment.aggregate([
      { $match: { client_id: clientId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalSpend = totalSpendResult[0]?.total || 0;

    const totalAddedFunds = totalFundsResult[0]?.total || 0;

    // Calculate available balance (prevent negative values)
    const availableBalance = Math.max(0, totalAddedFunds - totalSpend);

    // Round to 2 decimal places for currency precision
    const roundedTotalSpend = Math.round(totalSpend * 100) / 100;
    const roundedAvailableBalance = Math.round(availableBalance * 100) / 100;

    // Update client billing
    await Client.findByIdAndUpdate(clientId, {
      'billing.total_added_funds': totalAddedFunds,
      'billing.total_spend': roundedTotalSpend,
      'billing.available_balance': roundedAvailableBalance
    });
  }

  // Manual trigger method for testing
  async manualSync(clientId = null) {
    if (clientId) {
      const client = await Client.findById(clientId);
      if (client) await this.syncClient(client);
    } else {
      await this.syncAllClients();
    }
  }
}

const syncService = new SyncService();

export default syncService;