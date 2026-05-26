#!/bin/sh
set -e

# Script to modify DATABASE_URI by appending a suffix based on COOLIFY_FQDN
# This is useful for preview deployments where each PR gets a unique database
# Always writes /tmp/database_uri.env so the runner stage can source it

echo "========================================"
echo "Database URI Modifier"
echo "========================================"

# Check if BUILD_ENV is set to preview
if [ "$BUILD_ENV" != "preview" ]; then
    echo "BUILD_ENV is not 'preview' (current: ${BUILD_ENV:-not set})"
    echo "Skipping DATABASE_URI modification"
    echo "DATABASE_URI: $DATABASE_URI"
    # Always write the env file so COPY in runner stage works
    echo "export DATABASE_URI='$DATABASE_URI'" > /tmp/database_uri.env
    exit 0
fi

echo "BUILD_ENV: preview - proceeding with DATABASE_URI modification"

# Check if COOLIFY_FQDN is set
if [ -z "$COOLIFY_FQDN" ]; then
    echo "COOLIFY_FQDN is not set, using DATABASE_URI as-is"
    echo "DATABASE_URI: $DATABASE_URI"
    # Always write the env file so COPY in runner stage works
    echo "export DATABASE_URI='$DATABASE_URI'" > /tmp/database_uri.env
    exit 0
fi

echo "COOLIFY_FQDN: $COOLIFY_FQDN"

# Extract the prefix (e.g., "pr-330" from "pr-330.pragmaticpapers.com")
PREFIX=$(echo "$COOLIFY_FQDN" | cut -d'.' -f1)
echo "Extracted prefix: $PREFIX"

# Check if DATABASE_URI is set
if [ -z "$DATABASE_URI" ]; then
    echo "ERROR: DATABASE_URI is not set"
    exit 1
fi

echo "Original DATABASE_URI: $DATABASE_URI"

# Parse DATABASE_URI to extract components
# Format: postgresql://user:password@host:port/database

# Check for both postgres:// and postgresql:// prefixes
if echo "$DATABASE_URI" | grep -q "^postgresql://"; then
    URI_PREFIX="postgresql://"
elif echo "$DATABASE_URI" | grep -q "^postgres://"; then
    URI_PREFIX="postgres://"
else
    echo "ERROR: DATABASE_URI must start with postgresql:// or postgres://"
    exit 1
fi

# Remove prefix
URI_WITHOUT_PREFIX=${DATABASE_URI#$URI_PREFIX}

# Extract database name (after last /)
DB_NAME=$(echo "$URI_WITHOUT_PREFIX" | sed 's/.*\///')

# Extract everything before database name
URI_BASE=$(echo "$URI_WITHOUT_PREFIX" | sed 's/\(.*\)\/.*/\1/')

# Create sanitized suffix (replace hyphens with underscores for database name compatibility)
SANITIZED_SUFFIX=$(echo "$PREFIX" | tr '-' '_')

# Construct new database name with suffix
NEW_DB_NAME="${DB_NAME}_${SANITIZED_SUFFIX}"

# Construct new DATABASE_URI
NEW_DATABASE_URI="${URI_PREFIX}${URI_BASE}/${NEW_DB_NAME}"

echo "New database name: $NEW_DB_NAME"
echo "Modified DATABASE_URI: $NEW_DATABASE_URI"

# Export the modified DATABASE_URI for subsequent commands
# We'll write it to a file that can be sourced
echo "export DATABASE_URI='$NEW_DATABASE_URI'" > /tmp/database_uri.env

echo "========================================"
echo "Database URI modification complete"
echo "========================================"
