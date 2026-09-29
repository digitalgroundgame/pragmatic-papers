#!/bin/sh
set -e

# The image carries no credentials, so the connection string comes only from the
# DATABASE_URI Coolify passes at runtime ("Runtime" must be ticked for it).
if [ -z "$DATABASE_URI" ]; then
    echo "ERROR: DATABASE_URI is not set at runtime (Coolify: enable Runtime for it)"
    exit 1
fi

# Preview deployments run on their own database: apply the name the build chose
# (modify-database-uri.sh) to that DATABASE_URI. The helpers and the name sit next
# to this script in /app.
APP_DIR=$(dirname "$0")
. "$APP_DIR/database-uri.sh"
use_preview_database "$APP_DIR/database_name"

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
