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

    // 1. Fetch total metrics + impression-share metrics
    //    Impression share fields are ratios (0-1) and only populated for Search
    //    campaigns; other campaign types return null/undefined which we treat as 0.
    const metricsData = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.search_impression_share,
        metrics.search_rank_lost_impression_share,
        metrics.search_budget_lost_top_impression_share,
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



    // Helper: impression share comes back as a ratio (0-1); convert to %.
    // Returns 0 when the field is null (non-Search campaign or no data).
    const toPct = (v) =>
      v === null || v === undefined ? 0 : Math.round(v * 10000) / 100;

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
        search_impression_share: toPct(row.metrics.search_impression_share),
        search_rank_lost_impression_share: toPct(row.metrics.search_rank_lost_impression_share),
        search_budget_lost_top_impression_share: toPct(row.metrics.search_budget_lost_top_impression_share),
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

  /**
   * Fetch keyword-level performance metrics from Google Ads.
   * Returns one row per (keyword, date) within the requested window.
   */
  async fetchKeywordMetrics(customerId, fromDate = null, toDate = null) {
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

    const rows = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        segments.date
      FROM keyword_view
      WHERE segments.date BETWEEN '${formattedStart}' AND '${today}'
        AND campaign.status != 'REMOVED'
        AND ad_group.status != 'REMOVED'
        AND ad_group_criterion.status != 'REMOVED'
    `);

    // match_type enum values from google-ads-api come back as integers OR strings.
    // Normalize to string enums for storage.
    const matchTypeMap = {
      2: 'EXACT',
      3: 'PHRASE',
      4: 'BROAD',
      EXACT: 'EXACT',
      PHRASE: 'PHRASE',
      BROAD: 'BROAD'
    };
    const statusMap = {
      2: 'ENABLED',
      3: 'PAUSED',
      4: 'REMOVED',
      ENABLED: 'ENABLED',
      PAUSED: 'PAUSED',
      REMOVED: 'REMOVED'
    };

    return rows.map(row => ({
      campaign_id: String(row.campaign.id),
      campaign_name: row.campaign.name,
      ad_group_id: String(row.ad_group.id),
      ad_group_name: row.ad_group.name,
      criterion_id: String(row.ad_group_criterion.criterion_id),
      keyword_text: row.ad_group_criterion.keyword?.text || '',
      match_type: matchTypeMap[row.ad_group_criterion.keyword?.match_type] || 'UNKNOWN',
      status: statusMap[row.ad_group_criterion.status] || 'UNKNOWN',
      date: row.segments.date,
      impressions: row.metrics.impressions || 0,
      clicks: row.metrics.clicks || 0,
      cost: this.convertMicrosToCurrency(row.metrics.cost_micros || 0),
      conversions: row.metrics.conversions || 0
    }));
  }
}

const googleAdsService = new GoogleAdsService();

export default googleAdsService;
