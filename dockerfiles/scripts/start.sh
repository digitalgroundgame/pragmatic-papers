#!/bin/sh
set -e

# Source the isolated DATABASE_URI if it exists (preview deployments)
if [ -f /app/database_uri.env ]; then . /app/database_uri.env; fi

echo "========================================="
echo "Starting Pragmatic Papers Application"
echo "Node version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Database: PostgreSQL"
echo "Port: $PORT"
echo "Hostname: $HOSTNAME"
echo "Storage: $([ "$USE_LOCAL_STORAGE" = "true" ] && echo "Local" || echo "S3")"
echo "========================================="

# Report deployment success to GitHub (no-op if GITHUB_DEPLOYMENT_TOKEN unset)
./notify-github-deployment.sh || true

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
