import { GoogleAdsApi } from "google-ads-api";
import dotenv from "dotenv";

dotenv.config();

class GoogleAdsService {
  constructor() {
    this.client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID?.replace(/\r?\n/g, "").trim(),
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET?.replace(
        /\r?\n/g,
        "",
      ).trim(),
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.replace(
        /\r?\n/g,
        "",
      ).trim(),
    });
  }

  // Create customer instance for a specific client
  getCustomer(customerId) {
    return this.client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN?.replace(
        /\r?\n/g,
        "",
      ).trim(),
      login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(
        /\r?\n/g,
        "",
      ).trim(),
    });
  }

  // Convert micros to currency (Google Ads uses micros for precision)
  convertMicrosToCurrency(micros) {
    return micros / 1000000; // 1,000,000 micros = 1 currency unit
  }

  // Aggregate click types - now shows ALL click types individually
  aggregateClickBreakdown(clickTypeData) {
    const breakdown = { website_clicks: 0, call_clicks: 0 };
    const rawClickTypes = [];

    clickTypeData.forEach((item) => {
      const clicks = item.clicks || 0;
      const clickType = item.click_type; // This is a number

      // Store raw click type data
      rawClickTypes.push({
        click_type: clickType,
        clicks: clicks
      });

      // Map known click types to categories
      switch (clickType) {
        case 2: // URL_CLICKS
          breakdown.website_clicks += clicks;
          break;
        case 3: // CALLS
          breakdown.call_clicks += clicks;
          break;
        // Don't force unknown types into "other" - let them be shown as raw
      }
    });

    return {
      breakdown,
      rawClickTypes
    };
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

  async validateCustomerId(customerId) {
    try {
      const customer = this.getCustomer(customerId);
      // Try a simple query to verify the customer exists
      const result = await customer.query(`
        SELECT
          customer.id,
          customer.descriptive_name
        FROM customer
        LIMIT 1
      `);
      return {
        valid: true,
        customerId: customerId,
        accountName: result[0]?.customer.descriptive_name || "",
      };
    } catch (error) {
      console.error("Validate customer ID error:", error);
      return {
        valid: false,
        customerId: customerId,
        error: error.message,
      };
    }
  }

  async fetchMetricsWithClicks(customerId, fromDate = null, toDate = null) {
    const customer = this.getCustomer(customerId);

    const today = toDate
      ? new Date(toDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    let formattedStart;
    if (fromDate) {
      formattedStart = new Date(fromDate).toISOString().split("T")[0];
    } else {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      formattedStart = startDate.toISOString().split("T")[0];
    }

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
      WHERE segments.date BETWEEN '${formattedStart}' AND '${today}'
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
      WHERE segments.date BETWEEN '${formattedStart}' AND '${today}'
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
    return Object.keys(metricsGrouped).map((key) => {
      const clickData = this.aggregateClickBreakdown(
        clickTypeGrouped[key] || [],
      );
      return {
        ...metricsGrouped[key],
        click_breakdown: clickData.breakdown,
        raw_click_types: clickData.rawClickTypes,
      };
    });
  }
}

const googleAdsService = new GoogleAdsService();

export default googleAdsService;
