# CRM ARA Backend

A complete Node.js/Express backend for CRM (Customer Relationship Management) system with role-based access control, campaign tracking, and financial management.

## Features

- User authentication with JWT
- Role-based access control (Superadmin, Admin, Staff)
- Permission-based authorization
- Lead management with conversion tracking
- Client management
- Financial tracking (Fund entries)
- Daily entries and metrics
- Campaign performance tracking (Meta & Google)
- Client vault for sensitive data (encrypted)
- Comprehensive reporting and analytics
- Input validation
- Rate limiting
- Security best practices with Helmet
- Error handling

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs for password hashing
- express-validator for validation
- helmet for security
- morgan for logging
- cookie-parser
- express-rate-limit

## Project Structure

```
backend/
├── config/
│   └── db.js                 # Database configuration
├── controllers/              # Route controllers
│   ├── authController.js
│   ├── userController.js
│   ├── leadController.js
│   ├── clientController.js
│   ├── dailyEntryController.js
│   ├── fundEntryController.js
│   ├── dailyLeadDataController.js
│   ├── clientVaultController.js
│   └── reportsController.js
├── middleware/               # Custom middleware
│   ├── auth.js              # JWT authentication
│   ├── errorHandler.js      # Error handling
│   ├── validation.js        # Request validation
│   └── permissions.js       # Permission checks
├── models/                   # Mongoose models
│   ├── User.js
│   ├── Lead.js
│   ├── Client.js
│   ├── DailyEntry.js
│   ├── FundEntry.js
│   ├── DailyLeadData.js
│   └── ClientVault.js
├── routes/                   # API routes
│   ├── auth.js
│   ├── users.js
│   ├── leads.js
│   ├── clients.js
│   ├── dailyEntries.js
│   ├── fundEntries.js
│   ├── dailyLeadData.js
│   ├── clientVaults.js
│   └── reports.js
├── utils/                    # Utility functions
│   ├── generateToken.js
│   ├── encryption.js
│   └── validators.js
├── .env.example             # Environment variables template
├── package.json
├── server.js               # Application entry point
└── README.md

```

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

4. Update `.env` with your configuration:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://AraDiscoveriesTechMongoDB:PrivateVcore%40456@aradiscoveriestechcluster.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000
JWT_SECRET=your_jwt_secret_key_here_min_32_chars
JWT_EXPIRE=30d
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_REFRESH_EXPIRE=90d
COOKIE_EXPIRE=30
CLIENT_URL=https://crm.aradiscoveries.com
ENCRYPTION_KEY=your_32_character_encryption_key_here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

5. Start the server:

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register user (Admin only)
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update-details` - Update user details
- `PUT /api/auth/update-password` - Update password

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PATCH /api/users/:id/toggle-status` - Toggle user status
- `PATCH /api/users/:id/permissions` - Update user permissions
- `GET /api/users/stats` - Get user statistics

### Leads
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `POST /api/leads/:id/convert` - Convert lead to client
- `PATCH /api/leads/:id/assign` - Assign lead to user
- `PATCH /api/leads/:id/status` - Update lead status
- `GET /api/leads/stats` - Get lead statistics

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get single client
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client
- `PATCH /api/clients/:id/status` - Update client status
- `GET /api/clients/stats` - Get client statistics

### Daily Entries
- `GET /api/daily-entries` - Get all daily entries
- `GET /api/daily-entries/:id` - Get single entry
- `GET /api/daily-entries/date/:date` - Get entry by date
- `POST /api/daily-entries` - Create daily entry
- `PUT /api/daily-entries/:id` - Update daily entry
- `DELETE /api/daily-entries/:id` - Delete daily entry
- `GET /api/daily-entries/stats/summary` - Get entry statistics

### Fund Entries
- `GET /api/fund-entries` - Get all fund entries
- `GET /api/fund-entries/:id` - Get single entry
- `POST /api/fund-entries` - Create fund entry
- `PUT /api/fund-entries/:id` - Update fund entry
- `DELETE /api/fund-entries/:id` - Delete fund entry
- `PATCH /api/fund-entries/:id/approve` - Approve fund entry
- `GET /api/fund-entries/stats/summary` - Get fund statistics
- `GET /api/fund-entries/client/:clientId` - Get entries by client

### Daily Lead Data
- `GET /api/daily-lead-data` - Get all daily lead data
- `GET /api/daily-lead-data/:id` - Get single data
- `GET /api/daily-lead-data/date/:date` - Get data by date
- `POST /api/daily-lead-data` - Create daily lead data
- `PUT /api/daily-lead-data/:id` - Update daily lead data
- `DELETE /api/daily-lead-data/:id` - Delete daily lead data
- `GET /api/daily-lead-data/stats/summary` - Get lead data statistics
- `GET /api/daily-lead-data/stats/campaign-comparison` - Compare campaigns

### Client Vaults
- `GET /api/client-vaults` - Get all vaults
- `GET /api/client-vaults/:id` - Get single vault
- `GET /api/client-vaults/client/:clientId` - Get vault by client
- `POST /api/client-vaults` - Create vault
- `PUT /api/client-vaults/:id` - Update vault
- `DELETE /api/client-vaults/:id` - Delete vault
- `GET /api/client-vaults/:id/access-log` - Get access log

### Reports
- `GET /api/reports/dashboard` - Get dashboard overview
- `GET /api/reports/sales` - Get sales report
- `GET /api/reports/lead-performance` - Get lead performance
- `GET /api/reports/campaign-performance` - Get campaign performance
- `GET /api/reports/user-performance` - Get user performance
- `GET /api/reports/financial` - Get financial report

## User Roles & Permissions

### Roles
- **Superadmin**: Full access to all features
- **Admin**: Access to most features except user deletion
- **Staff**: Limited access to leads, clients, and reports

### Permission System
The system uses granular permissions for different operations:
- User management: `user:create`, `user:read`, `user:update`, `user:delete`
- Lead management: `lead:create`, `lead:read`, `lead:update`, `lead:delete`
- Client management: `client:create`, `client:read`, `client:update`, `client:delete`
- Financial: `fund:create`, `fund:read`, `fund:update`, `fund:delete`
- Daily entries: `entry:create`, `entry:read`, `entry:update`, `entry:delete`
- Client vault: `vault:read`, `vault:update`
- Reports: `report:view`, `report:export`
- Settings: `settings:update`

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Rate limiting to prevent abuse
- Helmet.js for security headers
- Input validation with express-validator
- Encrypted sensitive data in Client Vault
- Role-based access control (RBAC)
- Permission-based authorization
- Cookie-based token storage option
- CORS configuration

## Error Handling

The API uses consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Success responses:

```json
{
  "success": true,
  "data": { ... }
}
```

## Development

Run in development mode with auto-reload:

```bash
npm run dev
```

## Production

Set `NODE_ENV=production` in `.env` and run:

```bash
npm start
```

## License

ISC
