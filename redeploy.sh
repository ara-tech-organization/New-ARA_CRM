#!/bin/bash
set -e

echo "==> Pulling latest code..."
cd ~/ara-crm
git pull

echo "==> Restarting backend..."
sudo systemctl restart ara-crm

echo "==> Building frontend..."
cd ~/ara-crm/crm-frontend
npm run build

echo "==> Deploying frontend..."
sudo cp -r build/* /var/www/leadmatrix/
sudo chown -R www-data:www-data /var/www/leadmatrix

echo "✅ Deploy done"
