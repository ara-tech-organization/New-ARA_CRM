import { GoogleAdsApi } from "google-ads-api";
import dotenv from "dotenv";

dotenv.config();

class GoogleAdsService {
  constructor() {
    this.client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID?.replace(/\r?\n/g, '').trim(),
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET?.replace(/\r?\n/g, '').trim(),
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.replace(/\r?\n/g, '').trim(),
    });
  }

  // Create customer instance for a specific client
  getCustomer(customerId) {
    return this.client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN?.replace(/\r?\n/g, '').trim(),
      login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\r?\n/g, '').trim(),
    });
  }

  // Convert micros to currency (Google Ads uses micros for precision)
  convertMicrosToCurrency(micros) {
    return micros / 1000000; // 1,000,000 micros = 1 currency unit
  }

  // Aggregate click types
  aggregateClickBreakdown(clickTypeData) {
    const breakdown = { website_clicks: 0, call_clicks: 0, other_clicks: 0 };

    clickTypeData.forEach((item) => {
      const clicks = item.clicks || 0;
      switch (item.click_type) {
        case "WEBSITE":
          breakdown.website_clicks += clicks;
          break;
        case "CALLS":
          breakdown.call_clicks += clicks;
          break;
        default:
          breakdown.other_clicks += clicks;
      }
    });

    return breakdown;
  }

  async fetchCampaigns(customerId) {
    const customer = this.getCustomer(customerId);
    const campaigns = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.campaign_budget,
        campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `);

    return campaigns.map((c) => ({
      campaign_id: c.campaign.id,
      name: c.campaign.name,
      status: c.campaign.status,
      budget: this.convertMicrosToCurrency(c.campaign_budget.amount_micros),
    }));
  }

  async fetchMetricsWithClicks(customerId, dateRange = "LAST_30_DAYS") {
    const customer = this.getCustomer(customerId);

    // 1. Fetch total metrics (without click type segmentation)
    const metricsData = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        segments.date
      FROM campaign
      WHERE segments.date DURING ${dateRange}
      AND campaign.status != 'REMOVED'
    `);

    // 2. Fetch click type breakdown
    const clickTypeData = await customer.query(`
      SELECT
        campaign.id,
        segments.click_type,
        metrics.clicks,
        segments.date
      FROM campaign
      WHERE segments.date DURING ${dateRange}
      AND campaign.status != 'REMOVED'
    `);

    // Group total metrics by campaign and date
    const metricsGrouped = {};
    metricsData.forEach((row) => {
      const key = `${row.campaign.id}_${row.segments.date}`;
      metricsGrouped[key] = {
        campaign_id: row.campaign.id,
        campaign_name: row.campaign.name,
        date: row.segments.date,
        impressions: row.metrics.impressions || 0,
        clicks: row.metrics.clicks || 0,
        cost: this.convertMicrosToCurrency(row.metrics.cost_micros || 0),
        conversions: row.metrics.conversions || 0,
      };
    });

    // Group click type data by campaign and date
    const clickTypeGrouped = {};
    clickTypeData.forEach((row) => {
      const key = `${row.campaign.id}_${row.segments.date}`;
      if (!clickTypeGrouped[key]) {
        clickTypeGrouped[key] = [];
      }
      clickTypeGrouped[key].push({
        click_type: row.segments.click_type,
        clicks: row.metrics.clicks || 0,
      });
    });

    // Combine metrics with click breakdown
    return Object.keys(metricsGrouped).map((key) => ({
      ...metricsGrouped[key],
      click_breakdown: this.aggregateClickBreakdown(
        clickTypeGrouped[key] || [],
      ),
    }));
  }
}

const googleAdsService = new GoogleAdsService();

export default googleAdsService;
