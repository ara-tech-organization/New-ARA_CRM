import dotenv from "dotenv";

dotenv.config();

import mongoose from "mongoose";
import syncService from "../sync/syncService.js";
import Client from "../models/Client.js";
import Campaign from "../models/Campaign.js";
import Metric from "../models/Metric.js";
import Payment from "../models/Payment.js";

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI,
    );
    console.log("MongoDB connected for testing");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

console.log("GOOGLE ADS CONFIG:", {
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
});

// Test data - replace with your actual test client
const testClientData = {
  clientName: "Test Google Ads Client",
  google_ads_customer_id: process.env.TEST_GOOGLE_ADS_CUSTOMER_ID || "", // Replace with your test customer ID in XXX-XXX-XXXX format
  google_ads_enabled: true,
  status: "active",
};

const runGoogleAdsTest = async () => {
  try {
    console.log("🚀 Starting Google Ads Integration Test...\n");

    // 1. Check environment variables
    console.log("📋 Checking environment variables:");
    const requiredEnvVars = [
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      "GOOGLE_ADS_REFRESH_TOKEN",
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );
    if (missingVars.length > 0) {
      console.error(
        "❌ Missing environment variables:",
        missingVars.join(", "),
      );
      console.log("Please set these in your .env file");
      return;
    }
    console.log("✅ All required environment variables are set\n");

    // 2. Create or find test client
    console.log("👤 Setting up test client...");
    let testClient = await Client.findOne({
      clientName: testClientData.clientName,
    });

    if (!testClient) {
      testClient = new Client(testClientData);
      await testClient.save();
      console.log("✅ Created new test client");
    } else {
      // Update existing client with test data
      await Client.findByIdAndUpdate(testClient._id, testClientData);
      console.log("✅ Updated existing test client");
    }

    console.log(`Client ID: ${testClient._id}`);
    console.log(`Customer ID: ${testClient.google_ads_customer_id}\n`);

    // 3. Run manual sync
    console.log("🔄 Running Google Ads sync...");
    const startTime = Date.now();

    await syncService.manualSync(testClient._id);

    const duration = Date.now() - startTime;
    console.log(`✅ Sync completed in ${duration}ms\n`);

    // 4. Generate report
    console.log("📊 Generating Google Ads report...");

    const updatedClient = await Client.findById(testClient._id);
    const payments = await Payment.find({ client_id: testClient._id });
    const campaigns = await Campaign.find({ client_id: testClient._id });
    const metrics = await Metric.find({ client_id: testClient._id });

    // Aggregate total summary
    const totalSummary = metrics.reduce(
      (acc, m) => {
        acc.impressions += m.impressions || 0;
        acc.clicks += m.clicks || 0;
        acc.cost += m.cost || 0;
        acc.conversions += m.conversions || 0;
        acc.click_breakdown.website_clicks += m.click_breakdown?.website_clicks || 0;
        acc.click_breakdown.call_clicks += m.click_breakdown?.call_clicks || 0;
        acc.click_breakdown.other_clicks += m.click_breakdown?.other_clicks || 0;
        return acc;
      },
      {
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        click_breakdown: { website_clicks: 0, call_clicks: 0, other_clicks: 0 }
      }
    );

    totalSummary.ctr = totalSummary.impressions > 0 ? (totalSummary.clicks / totalSummary.impressions) * 100 : 0;
    totalSummary.avg_cpc = totalSummary.clicks > 0 ? totalSummary.cost / totalSummary.clicks : 0;
    totalSummary.cost_per_conversion = totalSummary.conversions > 0 ? totalSummary.cost / totalSummary.conversions : 0;

    // Build campaigns with aggregated metrics
    const campaignData = campaigns.map((camp) => {
      const campMetrics = metrics.filter((m) => m.campaign_id === camp.campaign_id.toString());
      const campSummary = campMetrics.reduce(
        (acc, m) => {
          acc.impressions += m.impressions || 0;
          acc.clicks += m.clicks || 0;
          acc.cost += m.cost || 0;
          acc.conversions += m.conversions || 0;
          acc.click_breakdown.website_clicks += m.click_breakdown?.website_clicks || 0;
          acc.click_breakdown.call_clicks += m.click_breakdown?.call_clicks || 0;
          acc.click_breakdown.other_clicks += m.click_breakdown?.other_clicks || 0;
          return acc;
        },
        {
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          click_breakdown: { website_clicks: 0, call_clicks: 0, other_clicks: 0 }
        }
      );

      campSummary.ctr = campSummary.impressions > 0 ? (campSummary.clicks / campSummary.impressions) * 100 : 0;
      campSummary.avg_cpc = campSummary.clicks > 0 ? campSummary.cost / campSummary.clicks : 0;

      return {
        campaign_id: camp.campaign_id,
        name: camp.name,
        status: camp.status,
        budget: {
          budget_id: `b_${camp.campaign_id}`,
          name: `${camp.name} Budget`,
          amount: camp.budget,
          delivery_method: "STANDARD",
          is_shared: false
        },
        metrics: campSummary,
        click_breakdown: campSummary.click_breakdown,
        ad_groups: [], // Not implemented
        ads: [] // Not implemented
      };
    });

    const report = {
      clients: [
        {
          customer_id: updatedClient.google_ads_customer_id,
          account_name: "ARA Discoveries Private Limited", // Hardcoded for test
          currency: "INR",
          time_zone: "Asia/Kolkata",
          date_range: "LAST_30_DAYS",
          billing: updatedClient.billing,
          payments: payments.map((p) => ({
            payment_id: p._id.toString(),
            amount: p.amount,
            method: p.method,
            date: p.date.toISOString().split("T")[0]
          })),
          summary: totalSummary,
          campaigns: campaignData,
          segments: {
            device: [],
            geo: [],
            date: []
          }
        }
      ]
    };

    console.log(JSON.stringify(report, null, 2));

    console.log("🎉 Google Ads report generated successfully!");

    // Optional: Clean up test data
    console.log("\n🧹 Cleaning up test data...");
    await Campaign.deleteMany({ client_id: testClient._id });
    await Metric.deleteMany({ client_id: testClient._id });
    await Client.findByIdAndDelete(testClient._id);
    console.log("✅ Test data cleaned up");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);

    // If it's an API error, show more details
    if (error.response) {
      console.error("API Error Details:");
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed");
  }
};

// Run the test
connectDB().then(() => {
  runGoogleAdsTest();
});
