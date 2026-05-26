#!/bin/sh
set -e

# Source the isolated DATABASE_URI if it exists (preview deployments)
if [ -f /app/database_uri.env ]; then . /app/database_uri.env; fi

# Extract database name from DATABASE_URI for display (credentials stripped)
if [ -n "${DATABASE_URI:-}" ]; then
    URI_TMP=${DATABASE_URI#postgresql://}
    URI_TMP=${URI_TMP#postgres://}
    if [ "$URI_TMP" != "$DATABASE_URI" ]; then
        DB_NAME=$(echo "$URI_TMP" | sed 's/.*\///' | sed 's/\?.*//')
    fi
fi

echo "========================================="
echo "Starting Pragmatic Papers Application"
echo "Node version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Database: PostgreSQL ${DB_NAME:+"($DB_NAME)"}"
echo "Port: $PORT"
echo "Hostname: $HOSTNAME"
echo "Storage: $([ "$USE_LOCAL_STORAGE" = "true" ] && echo "Local" || echo "S3")"
echo "========================================="
# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
