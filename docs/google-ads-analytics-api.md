# Google Ads Analytics API Endpoints Guide

## Overview

This document provides a comprehensive guide for frontend developers to integrate with the Google Ads Analytics API endpoints. All endpoints return JSON responses and follow RESTful conventions.

## Base URL

```
http://localhost:5000/api
```

---

## 🔗 Google Ads Management Endpoints

### 1. Associate Google Ads Account with Client

**Endpoint:** `PUT /google-ads/client/{clientId}/associate`  
**Description:** Associate a Google Ads customer ID with a CRM client

**Request Body:**

```json
{
  "customerId": "2000367396",
  "accountName": "Account Display Name"
}
```

**Success Response (200):**

```json
{
  "message": "Google Ads account associated successfully",
  "client": {
    "_id": "68deb02a11a12187d52ad0ac",
    "clientName": "Advanced Grohair & Gloskin Karaikudi",
    "google_ads_customer_id": "2000367396",
    "google_ads_account_name": "Ad Grohair & Gloskin Karaikudi",
    "google_ads_enabled": true
  }
}
```

**Error Responses:**

- `400`: `{ "error": "Customer ID is required" }`
- `404`: `{ "error": "Client not found" }`
- `409`: `{ "error": "Customer ID already associated with another client" }`

---

### 2. Bulk Associate Multiple Clients

**Endpoint:** `POST /google-ads/clients/bulk-associate`  
**Description:** Associate Google Ads accounts with multiple clients in a single transaction

**Request Body:**

```json
{
  "associations": [
    {
      "clientId": "68deb02a11a12187d52ad0ac",
      "customerId": "2000367396",
      "accountName": "Ad Grohair & Gloskin Karaikudi"
    },
    {
      "clientId": "another-client-id",
      "customerId": "3000367396",
      "accountName": "Another Account"
    }
  ]
}
```

**Success Response (200):**

```json
{
  "message": "Bulk association completed. 2 successful, 0 errors",
  "results": [
    {
      "clientId": "68deb02a11a12187d52ad0ac",
      "clientName": "Advanced Grohair & Gloskin Karaikudi",
      "customerId": "2000367396",
      "accountName": "Ad Grohair & Gloskin Karaikudi",
      "status": "success"
    }
  ],
  "errors": []
}
```

---

### 3. Get Unassociated Clients

**Endpoint:** `GET /google-ads/clients/unassociated`  
**Description:** Get list of clients that don't have Google Ads accounts associated

**Success Response (200):**

```json
{
  "count": 5,
  "clients": [
    {
      "clientName": "Client A",
      "place": "Location A",
      "organisationType": "Type A",
      "accountID": "ACC001",
      "status": "active"
    }
  ]
}
```

---

### 4. Validate Google Ads Customer ID

**Endpoint:** `POST /google-ads/validate-customer-id`  
**Description:** Validate if a Google Ads customer ID exists and get account name

**Request Body:**

```json
{
  "customerId": "2000367396"
}
```

**Success Response (200):**

```json
{
  "valid": true,
  "customerId": "2000367396",
  "accountName": "Ad Grohair & Gloskin Karaikudi"
}
```

**Invalid Response:**

```json
{
  "valid": false,
  "customerId": "invalid-id",
  "error": "Customer not found"
}
```

---

### 5. Enable/Disable Google Ads for Client

**Endpoint:** `PUT /google-ads/client/{clientId}/enable`  
**Description:** Enable or disable Google Ads sync for a client

**Request Body:**

```json
{
  "enabled": true
}
```

**Success Response (200):**

```json
{
  "message": "Google Ads enabled for client: Client Name",
  "client": {
    "clientName": "Advanced Grohair & Gloskin Karaikudi",
    "google_ads_enabled": true,
    "google_ads_customer_id": "2000367396"
  }
}
```

---

### 6. Manual Sync Operations

**Endpoint:** `POST /google-ads/sync`  
**Description:** Trigger manual sync for all clients

**Endpoint:** `POST /google-ads/sync/{clientId}`  
**Description:** Trigger manual sync for specific client

**Success Response (200):**

```json
{
  "message": "Sync completed for all clients"
}
```

### 7. Reload Sync Service
**Endpoint:** `POST /google-ads/reload-sync`  
**Description:** Reload the sync service configuration (useful after changing sync frequency)

**Success Response (200):**
```json
{
  "message": "Sync service reloaded successfully",
  "nextSyncIn": "15 minutes",
  "frequency": "Every 15 minutes",
  "timestamp": "2026-04-16T04:17:38.187Z",
  "note": "Server restart may be needed for full effect"
}
```

### 8. Get Sync Status
**Endpoint:** `GET /google-ads/sync-status`  
**Description:** Get current sync service configuration and status

**Success Response (200):**
```json
{
  "frequency": "Every 15 minutes",
  "nextSyncIn": "15 minutes (approximately)",
  "lastSyncTime": "2026-04-16T04:17:51.886Z",
  "status": "Active",
  "cronSchedule": "*/15 * * * *"
}
```

---

## 📊 Analytics Endpoints

### 7. Get All Clients Analytics Overview

**Endpoint:** `GET /analytics/clients`  
**Description:** Get overview analytics for all Google Ads-enabled clients

**Success Response (200):**

```json
{
  "count": 1,
  "clients": [
    {
      "clientId": "68deb02a11a12187d52ad0ac",
      "clientName": "Advanced Grohair & Gloskin Karaikudi",
      "googleAdsCustomerId": "2000367396",
      "googleAdsAccountName": "Ad Grohair & Gloskin Karaikudi",
      "fund": 50000,
      "availableBalance": 22530.8,
      "totalBudget": 8250,
      "totalCallClicks": 0,
      "totalWebsiteClicks": 0,
      "totalClicks": 370,
      "totalImpressions": 5277,
      "totalCost": 27469.2,
      "totalConversions": 4,
      "cpl": 6867.3,
      "ctr": 11.49,
      "cpc": 61.69,
      "cpa": 60.17,
      "roas": 0.01
    }
  ]
}
```

---

### 8. Get Detailed Client Analytics

**Endpoint:** `GET /analytics/client/{clientId}`  
**Description:** Get comprehensive analytics for a specific client with optional date filtering

**Query Parameters:**

- `start_date` (optional): YYYY-MM-DD format
- `end_date` (optional): YYYY-MM-DD format

**Example Request:**

```
GET /api/analytics/client/68deb02a11a12187d52ad0ac?start_date=2024-01-01&end_date=2024-12-31
```

**Success Response (200):**

```json
{
  "client": {
    "clientId": "68deb02a11a12187d52ad0ac",
    "clientName": "Advanced Grohair & Gloskin Karaikudi",
    "googleAdsCustomerId": "2000367396",
    "googleAdsAccountName": "Ad Grohair & Gloskin Karaikudi",
    "billing": {
      "billing_type": "monthly",
      "total_added_funds": 50000,
      "total_spend": 27469.2,
      "available_balance": 22530.8,
      "low_balance_threshold": 100
    }
  },
  "dateRange": {
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  },
  "summary": {
    "totalImpressions": 5277,
    "totalClicks": 370,
    "totalCost": 27469.2,
    "totalConversions": 4,
    "totalCallClicks": 0,
    "totalWebsiteClicks": 0,
    "totalOtherClicks": 370,
    "cpl": 6867.3,
    "ctr": 11.49,
    "cpc": 61.69,
    "cpa": 60.17,
    "roas": 0.01
  },
  "dailyMetrics": [
    {
      "date": "2024-01-15",
      "campaignId": "23694377170",
      "campaignName": "Hair Treatments -Search Leads",
      "impressions": 100,
      "clicks": 5,
      "cost": 250.5,
      "conversions": 1,
      "clickBreakdown": {
        "website_clicks": 3,
        "call_clicks": 2,
        "other_clicks": 0
      },
      "ctr": 5.0,
      "cpc": 50.1,
      "cpa": 250.5,
      "roas": 0.4
    }
  ],
  "campaignMetrics": [
    {
      "campaignId": "23694377170",
      "campaignName": "Hair Treatments -Search Leads",
      "impressions": 5277,
      "clicks": 370,
      "cost": 27469.2,
      "conversions": 4,
      "callClicks": 0,
      "websiteClicks": 0,
      "otherClicks": 370,
      "ctr": 11.49,
      "cpc": 61.69,
      "cpa": 60.17,
      "roas": 0.01
    }
  ],
  "campaigns": [
    {
      "_id": "campaign-id",
      "campaign_id": "23694377170",
      "name": "Hair Treatments -Search Leads",
      "budget": 1000,
      "status": "ENABLED"
    }
  ]
}
```

---

## 🧪 Testing Guide

### Using cURL for Testing

1. **Associate a client:**

```bash
curl -X PUT http://localhost:5000/api/google-ads/client/68deb02a11a12187d52ad0ac/associate \
  -H "Content-Type: application/json" \
  -d '{"customerId":"2000367396","accountName":"Ad Grohair & Gloskin Karaikudi"}'
```

2. **Get client analytics:**

```bash
curl -X GET http://localhost:5000/api/analytics/clients
```

3. **Get detailed client analytics:**

```bash
curl -X GET "http://localhost:5000/api/analytics/client/68deb02a11a12187d52ad0ac?start_date=2024-01-01&end_date=2024-12-31"
```

4. **Reload sync service:**

```bash
curl -X POST http://localhost:5000/api/google-ads/reload-sync
```

5. **Get sync status:**

```bash
curl -X GET http://localhost:5000/api/google-ads/sync-status
```

### Using Postman/Thunder Client

1. Set base URL: `http://localhost:5000/api`
2. Use appropriate HTTP methods (GET, POST, PUT)
3. Set Content-Type: `application/json` for POST/PUT requests
4. Add request body as JSON for POST/PUT endpoints

---

## 📋 Frontend Developer Integration Guide

### 1. Client Association Flow

```javascript
// Step 1: Validate Google Ads Customer ID before association
const validateCustomerId = async (customerId) => {
  try {
    const response = await fetch("/api/google-ads/validate-customer-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    });
    const data = await response.json();
    return data.valid ? data.accountName : null;
  } catch (error) {
    console.error("Validation failed:", error);
    return null;
  }
};

// Step 2: Associate client with Google Ads account
const associateClient = async (clientId, customerId, accountName) => {
  try {
    const response = await fetch(
      `/api/google-ads/client/${clientId}/associate`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, accountName }),
      },
    );
    const data = await response.json();

    if (response.ok) {
      // Success - trigger sync
      await triggerSync(clientId);
      return data;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error("Association failed:", error);
    throw error;
  }
};

// Step 3: Trigger data sync
const triggerSync = async (clientId) => {
  try {
    const response = await fetch(`/api/google-ads/sync/${clientId}`, {
      method: "POST",
    });
    return await response.json();
  } catch (error) {
    console.error("Sync failed:", error);
  }
};
```

### 2. Analytics Dashboard Implementation

```javascript
// Fetch all clients overview
const fetchClientsOverview = async () => {
  try {
    const response = await fetch("/api/analytics/clients");
    const data = await response.json();

    // Render client cards with key metrics
    data.clients.forEach((client) => {
      renderClientCard(client);
    });

    return data.clients;
  } catch (error) {
    console.error("Failed to fetch clients overview:", error);
  }
};

// Fetch detailed client analytics with date filter
const fetchClientAnalytics = async (clientId, startDate, endDate) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const response = await fetch(`/api/analytics/client/${clientId}?${params}`);
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Failed to fetch client analytics:", error);
  }
};
```

### 3. React Component Example

```javascript
import React, { useState, useEffect } from "react";

const GoogleAdsAnalytics = () => {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClientsOverview();
  }, []);

  const loadClientsOverview = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/analytics/clients");
      const data = await response.json();
      setClients(data.clients);
    } catch (error) {
      console.error("Failed to load clients:", error);
    }
    setLoading(false);
  };

  const loadClientAnalytics = async (clientId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/client/${clientId}`);
      const data = await response.json();
      setAnalytics(data);
      setSelectedClient(clientId);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    }
    setLoading(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <div className="google-ads-analytics">
      <h2>Google Ads Analytics Dashboard</h2>

      {loading && <div className="loading">Loading...</div>}

      <div className="clients-overview">
        <h3>Clients Overview</h3>
        <div className="clients-grid">
          {clients.map((client) => (
            <div
              key={client.clientId}
              className="client-card"
              onClick={() => loadClientAnalytics(client.clientId)}
            >
              <h4>{client.clientName}</h4>
              <div className="metrics">
                <div className="metric">
                  <span className="label">Clicks:</span>
                  <span className="value">{client.totalClicks}</span>
                </div>
                <div className="metric">
                  <span className="label">Cost:</span>
                  <span className="value">
                    {formatCurrency(client.totalCost)}
                  </span>
                </div>
                <div className="metric">
                  <span className="label">CTR:</span>
                  <span className="value">{formatPercentage(client.ctr)}</span>
                </div>
                <div className="metric">
                  <span className="label">CPC:</span>
                  <span className="value">{formatCurrency(client.cpc)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {analytics && (
        <div className="client-details">
          <h3>{analytics.client.clientName} - Detailed Analytics</h3>

          <div className="summary-metrics">
            <div className="metric-card">
              <h4>Total Impressions</h4>
              <span className="value">
                {analytics.summary.totalImpressions.toLocaleString()}
              </span>
            </div>
            <div className="metric-card">
              <h4>Total Clicks</h4>
              <span className="value">
                {analytics.summary.totalClicks.toLocaleString()}
              </span>
            </div>
            <div className="metric-card">
              <h4>Total Cost</h4>
              <span className="value">
                {formatCurrency(analytics.summary.totalCost)}
              </span>
            </div>
            <div className="metric-card">
              <h4>Conversions</h4>
              <span className="value">
                {analytics.summary.totalConversions}
              </span>
            </div>
            <div className="metric-card">
              <h4>CTR</h4>
              <span className="value">
                {formatPercentage(analytics.summary.ctr)}
              </span>
            </div>
            <div className="metric-card">
              <h4>CPC</h4>
              <span className="value">
                {formatCurrency(analytics.summary.cpc)}
              </span>
            </div>
          </div>

          <div className="campaigns-section">
            <h4>Campaign Performance</h4>
            <table className="campaigns-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Clicks</th>
                  <th>Cost</th>
                  <th>CTR</th>
                  <th>CPC</th>
                  <th>Conversions</th>
                </tr>
              </thead>
              <tbody>
                {analytics.campaignMetrics.map((campaign) => (
                  <tr key={campaign.campaignId}>
                    <td>{campaign.campaignName}</td>
                    <td>{campaign.clicks}</td>
                    <td>{formatCurrency(campaign.cost)}</td>
                    <td>{formatPercentage(campaign.ctr)}</td>
                    <td>{formatCurrency(campaign.cpc)}</td>
                    <td>{campaign.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleAdsAnalytics;
```

### 4. Error Handling Best Practices

```javascript
const handleApiError = (error, context) => {
  console.error(`${context} error:`, error);

  // Show user-friendly error messages
  const errorMessages = {
    "Client not found": "The selected client could not be found.",
    "Customer ID already associated":
      "This Google Ads account is already linked to another client.",
    "Customer ID must be exactly 10 digits":
      "Please enter a valid 10-digit Google Ads customer ID.",
    "Google Ads account associated successfully":
      "Client successfully linked to Google Ads!",
  };

  const message =
    errorMessages[error.message] ||
    "An unexpected error occurred. Please try again.";

  // Show toast notification or alert
  showNotification(
    message,
    error.message.includes("success") ? "success" : "error",
  );
};
```

### 5. Data Refresh Strategy

```javascript
// Auto-refresh analytics every 5 minutes
useEffect(() => {
  const interval = setInterval(() => {
    if (selectedClient) {
      loadClientAnalytics(selectedClient);
    }
  }, 300000); // 5 minutes

  return () => clearInterval(interval);
}, [selectedClient]);

// Manual refresh button
const handleRefresh = () => {
  if (selectedClient) {
    loadClientAnalytics(selectedClient);
  } else {
    loadClientsOverview();
  }
};
```

---

## 📊 Data Structure Reference

### Client Object

```javascript
{
  clientId: "string",           // MongoDB ObjectId
  clientName: "string",         // Client display name
  googleAdsCustomerId: "string", // 10-digit Google Ads ID
  googleAdsAccountName: "string", // Google Ads account name
  fund: number,                 // Total funds added (INR)
  availableBalance: number,     // Current balance (INR)
  totalBudget: number,          // Sum of all campaign budgets
  totalCallClicks: number,      // Total call clicks
  totalWebsiteClicks: number,   // Total website clicks
  totalClicks: number,          // Total clicks across all types
  totalImpressions: number,     // Total impressions
  totalCost: number,           // Total ad spend (INR)
  totalConversions: number,     // Total conversions
  cpl: number,                 // Cost Per Lead (INR)
  ctr: number,                 // Click Through Rate (%)
  cpc: number,                 // Cost Per Click (INR)
  cpa: number,                 // Cost Per Acquisition (INR)
  roas: number                 // Return on Ad Spend
}
```

### Campaign Metrics

```javascript
{
  campaignId: "string",        // Google Ads campaign ID
  campaignName: "string",      // Campaign display name
  impressions: number,
  clicks: number,
  cost: number,
  conversions: number,
  callClicks: number,
  websiteClicks: number,
  otherClicks: number,
  ctr: number,                 // Average CTR (%)
  cpc: number,                 // Average CPC (INR)
  cpa: number,                 // Average CPA (INR)
  roas: number                 // Average ROAS
}
```

---

## 🔒 Authentication & Security Notes

- All endpoints are currently unprotected (for development)
- In production, add authentication middleware to protect sensitive endpoints
- Consider rate limiting for analytics endpoints
- Validate input data on both frontend and backend
- Use HTTPS in production environment

---

## 📝 Changelog

- **v1.0.0** - Initial release with core Google Ads analytics functionality
- Comprehensive client association system
- Real-time KPI calculations and analytics endpoints
- Automated sync system (6-hour intervals)
- Full frontend integration examples
