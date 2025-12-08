#!/bin/bash

# AIDA-3D Deployment Script
# This script is called by GitHub Actions after files are uploaded

set -e

echo "Starting AIDA-3D deployment..."

# Navigate to deployment directory
cd /home/ubuntu/AIDA-3D_deploy

# Stop existing PM2 process if running
pm2 stop aida-3d || echo "aida-3d process not running"

# Delete existing PM2 process
pm2 delete aida-3d || echo "aida-3d process not found"

# Start the application using PM2 ecosystem file
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

echo "AIDA-3D deployment completed successfully!"
echo "Application is running on port 3000"

# Show status
pm2 status aida-3d