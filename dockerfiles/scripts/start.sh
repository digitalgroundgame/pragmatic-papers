#!/bin/sh
set -e

# Preview deployments run on their own database: apply the name the build chose
# (modify-database-uri.sh) to the DATABASE_URI Coolify passes at runtime.
. /app/database-uri.sh
use_preview_database /app/database_name

echo "========================================="
echo "Starting Pragmatic Papers Application"
echo "Node version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Database: PostgreSQL ($(uri_database "$DATABASE_URI"))"
echo "Port: $PORT"
echo "Hostname: $HOSTNAME"
echo "Storage: $([ "$USE_LOCAL_STORAGE" = "true" ] && echo "Local" || echo "S3")"
echo "========================================="
# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
