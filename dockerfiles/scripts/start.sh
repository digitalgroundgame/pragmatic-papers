#!/bin/sh
set -e

# Source the build.env to get the potentially modified DATABASE_URI for preview deployments
if [ -f /app/build.env ]; then
  . /app/build.env
fi

echo "========================================="
echo "Starting Pragmatic Papers Application"
echo "Node version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Database: PostgreSQL"
echo "Port: $PORT"
echo "Hostname: $HOSTNAME"
echo "Log Level: ${PAYLOAD_LOG_LEVEL:-info (default)}"
echo "Storage: $([ "$USE_LOCAL_STORAGE" = "true" ] && echo "Local" || echo "S3")"
echo "========================================="

# 1. Database Connectivity Check & Migrations
# We use a simple retry loop to wait for the database to be ready.
# This is crucial in environments where the DB container might start slightly after the app.
echo "Checking database connectivity..."
MAX_RETRIES=5
RETRY_COUNT=0

# Note: We use 'pnpm payload migrate:status' as a lightweight connectivity test
until pnpm payload migrate:status || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  echo "Database not ready yet... (Attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Could not connect to the database after $MAX_RETRIES attempts."
  echo "Check your DATABASE_URI and network settings."
  exit 1
fi

echo "Running database migrations..."
if pnpm payload migrate; then
  echo "Migrations completed successfully."
else
  echo "========================================="
  echo "CRITICAL ERROR: Database migrations failed!"
  echo "The application will not start to prevent data corruption."
  echo "Check the logs above for specific Drizzle/Payload errors."
  echo "========================================="
  exit 1
fi

# 2. Start the Next.js server
echo "Starting Next.js server..."
# Using exec to replace the shell process with the Node.js process
exec node --trace-warnings server.js
