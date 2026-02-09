# CRM ARA API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

Or a cookie named `token` with the JWT token.

---

## Authentication Endpoints

### Login
**POST** `/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "...",
    "userID": "USR001",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin",
    "permissions": [...]
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### Register (Admin/Superadmin only)
**POST** `/auth/register`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "New User",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "staff",
  "phone": "+1234567890",
  "department": "Sales"
}
```

### Get Current User
**GET** `/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userID": "USR001",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin",
    "permissions": [...]
  }
}
```

### Logout
**POST** `/auth/logout`

**Headers:** `Authorization: Bearer <token>`

### Update Details
**PUT** `/auth/update-details`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "phone": "+1234567890"
}
```

### Update Password
**PUT** `/auth/update-password`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

---

## User Management Endpoints

### Get All Users
**GET** `/users?page=1&limit=10&search=john&role=admin&isActive=true`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name, email, or userID
- `role` (optional): Filter by role
- `isActive` (optional): Filter by active status

**Response:**
```json
{
  "success": true,
  "count": 10,
  "total": 50,
  "totalPages": 5,
  "currentPage": 1,
  "data": [...]
}
```

### Get Single User
**GET** `/users/:id`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

### Create User
**POST** `/users`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

**Body:**
```json
{
  "name": "New User",
  "email": "user@example.com",
  "password": "password123",
  "role": "staff",
  "phone": "+1234567890",
  "department": "Sales"
}
```

### Update User
**PUT** `/users/:id`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

### Delete User
**DELETE** `/users/:id`

**Headers:** `Authorization: Bearer <token>` (Superadmin only)

### Toggle User Status
**PATCH** `/users/:id/toggle-status`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

### Update User Permissions
**PATCH** `/users/:id/permissions`

**Headers:** `Authorization: Bearer <token>` (Superadmin only)

**Body:**
```json
{
  "permissions": ["lead:read", "lead:create", "client:read"]
}
```

### Get User Stats
**GET** `/users/stats`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

---

## Lead Management Endpoints

### Get All Leads
**GET** `/leads?page=1&limit=10&search=john&status=new&source=website`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`, `limit`, `search`
- `status`: new, contacted, qualified, proposal, negotiation, won, lost
- `source`: website, referral, social, email, call, meta, google, other
- `assignedTo`: User ID
- `dateFrom`, `dateTo`: Date range filter
- `convertedToClient`: true/false

### Get Single Lead
**GET** `/leads/:id`

**Headers:** `Authorization: Bearer <token>`

### Create Lead
**POST** `/leads`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "company": "ABC Corp",
  "status": "new",
  "source": "website",
  "value": 5000,
  "notes": "Interested in our premium package"
}
```

### Update Lead
**PUT** `/leads/:id`

**Headers:** `Authorization: Bearer <token>`

### Delete Lead
**DELETE** `/leads/:id`

**Headers:** `Authorization: Bearer <token>`

### Convert Lead to Client
**POST** `/leads/:id/convert`

**Headers:** `Authorization: Bearer <token>`

**Body (optional):**
```json
{
  "contractValue": 50000,
  "billingCycle": "monthly",
  "contractStartDate": "2024-01-01"
}
```

### Assign Lead
**PATCH** `/leads/:id/assign`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "userId": "user_id_here"
}
```

### Update Lead Status
**PATCH** `/leads/:id/status`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "status": "qualified"
}
```

### Get Lead Stats
**GET** `/leads/stats`

**Headers:** `Authorization: Bearer <token>`

---

## Client Management Endpoints

### Get All Clients
**GET** `/clients?page=1&limit=10&search=company&status=active`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`, `limit`, `search`
- `status`: active, inactive, pending, suspended
- `accountManager`: User ID
- `dateFrom`, `dateTo`: Date range

### Get Single Client
**GET** `/clients/:id`

**Headers:** `Authorization: Bearer <token>`

### Create Client
**POST** `/clients`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "name": "Company Name",
  "email": "contact@company.com",
  "phone": "+1234567890",
  "company": "Company Name Ltd",
  "status": "active",
  "contractValue": 50000,
  "billingCycle": "monthly"
}
```

### Update Client
**PUT** `/clients/:id`

**Headers:** `Authorization: Bearer <token>`

### Delete Client
**DELETE** `/clients/:id`

**Headers:** `Authorization: Bearer <token>`

### Update Client Status
**PATCH** `/clients/:id/status`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "status": "active"
}
```

### Get Client Stats
**GET** `/clients/stats`

**Headers:** `Authorization: Bearer <token>`

---

## Daily Entry Endpoints

### Get All Daily Entries
**GET** `/daily-entries?page=1&limit=10&dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`

### Get Daily Entry by Date
**GET** `/daily-entries/date/:date`

**Headers:** `Authorization: Bearer <token>`

### Create Daily Entry
**POST** `/daily-entries`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "date": "2024-01-27",
  "totalLeads": 10,
  "newLeads": 5,
  "qualifiedLeads": 3,
  "convertedLeads": 2,
  "revenue": 10000,
  "expenses": 3000,
  "metaSpend": 500,
  "googleSpend": 300
}
```

### Get Daily Entry Stats
**GET** `/daily-entries/stats/summary?dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`

---

## Fund Entry Endpoints

### Get All Fund Entries
**GET** `/fund-entries?page=1&type=income&category=client_payment`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `type`: income, expense, investment, withdrawal
- `category`: client_payment, ad_spend, salary, office_expense, software, marketing, commission, refund, other
- `status`: pending, completed, cancelled, failed
- `clientId`, `dateFrom`, `dateTo`

### Create Fund Entry
**POST** `/fund-entries`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "amount": 5000,
  "type": "income",
  "category": "client_payment",
  "date": "2024-01-27",
  "description": "Payment from client",
  "client": "client_id_here",
  "paymentMethod": "bank_transfer"
}
```

### Approve Fund Entry
**PATCH** `/fund-entries/:id/approve`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

### Get Fund Entry Stats
**GET** `/fund-entries/stats/summary?dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`

### Get Fund Entries by Client
**GET** `/fund-entries/client/:clientId`

**Headers:** `Authorization: Bearer <token>`

---

## Daily Lead Data Endpoints

### Get All Daily Lead Data
**GET** `/daily-lead-data?dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`

### Create Daily Lead Data
**POST** `/daily-lead-data`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "date": "2024-01-27",
  "metaData": {
    "formLeads": 10,
    "whatsAppLeads": 5,
    "spend": 500,
    "impressions": 10000,
    "clicks": 500,
    "conversions": 3
  },
  "googleData": {
    "callLeads": 8,
    "websiteLeads": 12,
    "spend": 800,
    "impressions": 15000,
    "clicks": 700,
    "conversions": 5
  }
}
```

### Get Campaign Comparison
**GET** `/daily-lead-data/stats/campaign-comparison?dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`

---

## Client Vault Endpoints

### Get All Client Vaults
**GET** `/client-vaults`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

### Get Vault by Client ID
**GET** `/client-vaults/client/:clientId`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

### Create Client Vault
**POST** `/client-vaults`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

**Body:**
```json
{
  "client": "client_id_here",
  "bankDetails": {
    "accountNumber": "1234567890",
    "bankName": "Bank Name",
    "ifscCode": "BANK0001234"
  },
  "taxInformation": {
    "taxId": "TAX123456",
    "gstNumber": "GST123456"
  }
}
```

### Get Vault Access Log
**GET** `/client-vaults/:id/access-log`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

---

## Reports Endpoints

### Get Dashboard Overview
**GET** `/reports/dashboard?dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalLeads": 100,
    "totalClients": 50,
    "totalRevenue": 500000,
    "totalExpense": 150000,
    "netProfit": 350000,
    "conversionRate": "50.00"
  }
}
```

### Get Sales Report
**GET** `/reports/sales?dateFrom=2024-01-01&dateTo=2024-01-31&groupBy=month`

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `groupBy`: day, week, month, year

### Get Lead Performance Report
**GET** `/reports/lead-performance?dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`

### Get Campaign Performance Report
**GET** `/reports/campaign-performance?dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>`

### Get User Performance Report
**GET** `/reports/user-performance?dateFrom=2024-01-01&dateTo=2024-01-31`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

### Get Financial Report
**GET** `/reports/financial?dateFrom=2024-01-01&dateTo=2024-01-31&groupBy=month`

**Headers:** `Authorization: Bearer <token>` (Admin/Superadmin)

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limiting

API requests are limited to 100 requests per 15 minutes per IP address. When the limit is exceeded, you'll receive a `429` status code.

---

## Pagination

List endpoints support pagination:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

Response includes:
```json
{
  "count": 10,
  "total": 50,
  "totalPages": 5,
  "currentPage": 1,
  "data": [...]
}
```

---

## Date Filters

Date parameters should be in ISO 8601 format:
- `YYYY-MM-DD` (e.g., `2024-01-27`)
- `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g., `2024-01-27T10:30:00.000Z`)

---

## Permissions

Different operations require specific permissions. Check with your administrator if you receive `403 Forbidden` errors.
