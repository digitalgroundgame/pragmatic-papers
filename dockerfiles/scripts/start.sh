#!/bin/sh
set -e

echo "========================================="
echo "Starting Pragmatic Papers Application"
echo "Node version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Database: PostgreSQL"
echo "Port: $PORT"
echo "Hostname: $HOSTNAME"
echo "Storage: $([ "$USE_LOCAL_STORAGE" = "true" ] && echo "Local" || echo "S3")"
echo "========================================="
# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
