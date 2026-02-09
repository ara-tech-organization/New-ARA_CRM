# Quick Start Guide

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update the following variables:

```env
# Database - Azure Cosmos DB
MONGODB_URI=mongodb+srv://AraDiscoveriesTechMongoDB:PrivateVcore%40456@aradiscoveriestechcluster.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000

# JWT Secrets (generate random strings)
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_min_32_characters
JWT_REFRESH_SECRET=your_very_long_and_secure_refresh_secret_key

# Encryption Key (32 characters)
ENCRYPTION_KEY=your_32_character_encryption_key

# Other settings
NODE_ENV=production
PORT=5000
CLIENT_URL=https://crm.aradiscoveries.com
```

**Important:** Generate secure random strings for JWT secrets and encryption key. You can use:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start MongoDB

Make sure MongoDB is running on your system:

```bash
# Using MongoDB service
sudo service mongod start

# Or using MongoDB directly
mongod
```

### 4. Seed the Database (Optional)

To create sample data including test users:

```bash
npm run seed
```

This will create:
- Superadmin: `superadmin@crm-ara.com` / `password123`
- Admin: `admin@crm-ara.com` / `password123`
- Staff: `staff1@crm-ara.com` / `password123`
- Sample leads and clients

### 5. Start the Server

For development (with auto-reload):

```bash
npm run dev
```

For production:

```bash
npm start
```

The server will start at `http://localhost:5000`

## Test the API

### 1. Health Check

```bash
curl http://localhost:5000/health
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@crm-ara.com",
    "password": "password123"
  }'
```

Save the `accessToken` from the response.

### 3. Get Current User

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Get Dashboard Overview

```bash
curl http://localhost:5000/api/reports/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## API Documentation

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## Project Structure

```
backend/
├── config/           # Configuration files
├── controllers/      # Request handlers
├── middleware/       # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── scripts/         # Utility scripts
├── utils/           # Helper functions
└── server.js        # Entry point
```

## Common Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production mode
npm start

# Seed database
npm run seed
```

## Default Permissions by Role

### Superadmin
- Full access to all features

### Admin
- User management (read, update)
- Lead management (full CRUD)
- Client management (full CRUD)
- Financial management (full CRUD)
- Vault access
- All reports

### Staff
- Lead management (create, read, update)
- Client management (read only)
- Financial data (read only)
- Basic reports

## Security Notes

1. Always use strong, unique passwords
2. Generate secure random strings for JWT secrets
3. Use environment variables for sensitive data
4. Enable HTTPS in production
5. Regularly update dependencies
6. Monitor access logs for suspicious activity

## Troubleshooting

### MongoDB Connection Error

If you see `Error: connect ECONNREFUSED`, make sure MongoDB is running:

```bash
sudo service mongod start
```

### Port Already in Use

If port 5000 is already in use, change it in `.env`:

```env
PORT=3001
```

### JWT Errors

Make sure `JWT_SECRET` in `.env` is set and is at least 32 characters long.

### Permission Denied Errors

Make sure you're logged in as a user with appropriate permissions. Check your user's role and permissions.

## Next Steps

1. Review the API documentation
2. Test all endpoints using Postman or curl
3. Integrate with your frontend application
4. Configure production environment
5. Set up monitoring and logging

## Support

For issues or questions, check the documentation or contact your administrator.
