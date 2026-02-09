# CRM ARA Backend - Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Generate secure JWT secrets (minimum 32 characters)
- [ ] Generate secure encryption key (exactly 32 characters)
- [ ] Configure MongoDB connection string
- [ ] Set NODE_ENV to 'production'
- [ ] Configure client URL for CORS
- [ ] Review and adjust rate limiting settings

### 2. Security Review

- [ ] All sensitive data stored in environment variables
- [ ] No hardcoded credentials in code
- [ ] HTTPS enabled on production server
- [ ] Database authentication configured
- [ ] Firewall rules configured
- [ ] SSL/TLS certificates installed

### 3. Database Setup

- [ ] MongoDB installed and running
- [ ] Database backups configured
- [ ] Database user with appropriate permissions created
- [ ] Connection pooling configured
- [ ] Indexes verified

### 4. Application Testing

- [ ] All unit tests passing (if implemented)
- [ ] Integration tests completed
- [ ] Load testing performed
- [ ] Security scanning completed
- [ ] API endpoints tested

## Deployment Options

### Option 1: VPS/Dedicated Server (Ubuntu/Debian)

#### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Install PM2 for process management
sudo npm install -g pm2
```

#### Step 2: Deploy Application

```bash
# Clone repository
cd /var/www
git clone your-repository-url crm-ara
cd crm-ara/backend

# Install dependencies
npm install --production

# Create .env file
nano .env
# Paste your production environment variables

# Generate secure keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Use output for JWT_SECRET, JWT_REFRESH_SECRET, and ENCRYPTION_KEY

# Start with PM2
pm2 start server.js --name "crm-ara-backend"
pm2 save
pm2 startup
```

#### Step 3: Configure Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/crm-ara
```

Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/crm-ara /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 4: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

### Option 2: Docker Deployment

#### Dockerfile

Create `Dockerfile` in backend directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

#### docker-compose.yml

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: crm-ara-mongodb
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: your_secure_password

  backend:
    build: .
    container_name: crm-ara-backend
    restart: always
    ports:
      - "5000:5000"
    depends_on:
      - mongodb
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: mongodb://admin:your_secure_password@mongodb:27017/crm-ara?authSource=admin
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_EXPIRE: 30d
      JWT_REFRESH_EXPIRE: 90d
      COOKIE_EXPIRE: 30
      CLIENT_URL: https://crm.aradiscoveries.com
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      RATE_LIMIT_WINDOW_MS: 900000
      RATE_LIMIT_MAX_REQUESTS: 100

volumes:
  mongodb_data:
```

#### Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

### Option 3: Cloud Platforms

#### Heroku

```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create crm-ara-backend

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret
heroku config:set JWT_REFRESH_SECRET=your_refresh_secret
heroku config:set ENCRYPTION_KEY=your_encryption_key
heroku config:set CLIENT_URL=your_frontend_url

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

#### AWS (Elastic Beanstalk)

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init

# Create environment
eb create crm-ara-production

# Set environment variables in AWS Console or via CLI
eb setenv NODE_ENV=production JWT_SECRET=your_secret

# Deploy
eb deploy

# View logs
eb logs
```

#### DigitalOcean App Platform

1. Connect your GitHub repository
2. Configure build settings:
   - Build Command: `npm install`
   - Run Command: `npm start`
3. Add environment variables in the dashboard
4. Deploy

## Post-Deployment Tasks

### 1. Initial Setup

```bash
# Seed initial data (optional, for first deployment)
npm run seed

# Or create superadmin manually using MongoDB
```

### 2. Monitoring Setup

```bash
# Setup PM2 monitoring (if using PM2)
pm2 monitor

# Install monitoring tools
npm install -g pm2-logrotate
pm2 install pm2-logrotate
```

### 3. Backup Configuration

#### MongoDB Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR

mongodump --uri="mongodb://localhost:27017/crm-ara" --out=$BACKUP_DIR/backup_$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

```bash
# Make executable
chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

### 4. Log Rotation

Create `/etc/logrotate.d/crm-ara`:

```
/var/www/crm-ara/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

## Environment Variables for Production

```env
# Server Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
MONGODB_URI=mongodb://username:password@host:port/database?authSource=admin

# JWT Configuration (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your_generated_64_character_hex_string_here
JWT_EXPIRE=30d
JWT_REFRESH_SECRET=your_generated_64_character_hex_string_here
JWT_REFRESH_EXPIRE=90d

# Cookie Configuration
COOKIE_EXPIRE=30

# Client URL (your frontend URL)
CLIENT_URL=https://your-frontend-domain.com

# Encryption Key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_generated_64_character_hex_string_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration (optional, for future use)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Security Best Practices

1. **Firewall Configuration**
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

2. **MongoDB Security**
   ```bash
   # Create admin user
   mongosh
   use admin
   db.createUser({
     user: "admin",
     pwd: "secure_password",
     roles: ["root"]
   })

   # Create app user
   use crm-ara
   db.createUser({
     user: "crm_user",
     pwd: "secure_password",
     roles: ["readWrite"]
   })
   ```

3. **Update MongoDB Configuration**
   ```bash
   sudo nano /etc/mongod.conf
   ```

   Add:
   ```yaml
   security:
     authorization: enabled
   ```

4. **Regular Updates**
   ```bash
   # Update Node.js dependencies
   npm update
   npm audit fix

   # Update system packages
   sudo apt update && sudo apt upgrade -y
   ```

## Monitoring & Maintenance

### Health Checks

Setup automated health checks:

```bash
# Create health check script
nano health-check.sh
```

```bash
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)
if [ $RESPONSE -ne 200 ]; then
    echo "Server is down! Response code: $RESPONSE"
    pm2 restart crm-ara-backend
    # Send alert (email, Slack, etc.)
fi
```

### Performance Monitoring

- Setup application monitoring (New Relic, DataDog, or similar)
- Monitor database performance
- Track API response times
- Set up alerts for errors and downtime

### Log Management

```bash
# View PM2 logs
pm2 logs crm-ara-backend

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

## Troubleshooting

### Application Won't Start

1. Check logs: `pm2 logs`
2. Verify environment variables: `pm2 env 0`
3. Check MongoDB connection: `mongosh`
4. Verify port availability: `netstat -tulpn | grep 5000`

### Database Connection Issues

1. Check MongoDB status: `sudo systemctl status mongod`
2. Verify connection string
3. Check database authentication
4. Review firewall rules

### Performance Issues

1. Check server resources: `htop`
2. Monitor MongoDB: `mongostat`
3. Review application logs
4. Check for slow queries
5. Verify indexes are in place

## Rollback Procedure

```bash
# Using PM2
pm2 stop crm-ara-backend
git checkout previous-stable-tag
npm install
pm2 restart crm-ara-backend

# Using Docker
docker-compose down
git checkout previous-stable-tag
docker-compose up -d --build
```

## Scaling Considerations

### Horizontal Scaling

1. Use load balancer (Nginx, HAProxy)
2. Deploy multiple instances
3. Use Redis for session management
4. Implement distributed caching

### Vertical Scaling

1. Upgrade server resources
2. Optimize database queries
3. Implement caching strategies
4. Use CDN for static assets

## Support & Maintenance

- Regular security updates
- Database backups (daily)
- Log monitoring
- Performance optimization
- Documentation updates

## Conclusion

This deployment guide covers common deployment scenarios. Adjust according to your specific infrastructure and requirements. Always test thoroughly before deploying to production.
