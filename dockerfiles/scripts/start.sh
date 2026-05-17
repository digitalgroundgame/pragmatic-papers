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

# 1. Basic Database Connectivity Check
# This ensures the DB is reachable before Node starts, but we don't run migrations here.
# Migrations are now handled in the build stage.
echo "Verifying database reachability..."
# Extract host and port from DATABASE_URI (primitive sh parser)
DB_HOST=$(echo $DATABASE_URI | sed -e 's|.*@||' -e 's|/.*||' -e 's|:.*||')
DB_PORT=$(echo $DATABASE_URI | sed -e 's|.*:||' -e 's|/.*||')
DB_PORT=${DB_PORT:-5432}

MAX_RETRIES=10
RETRY_COUNT=0

until nc -z "$DB_HOST" "$DB_PORT" || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  echo "Waiting for database at $DB_HOST:$DB_PORT... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 3
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "WARNING: Could not verify database reachability. Attempting to start anyway..."
fi

# 2. Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
