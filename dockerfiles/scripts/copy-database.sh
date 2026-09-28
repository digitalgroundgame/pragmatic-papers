#!/bin/sh
set -e

# Database copy script for preview deployments
# This script creates a copy of an existing database to isolate preview deployment migrations

echo "========================================"
echo "Database Copy Script for Preview Builds"
echo "========================================"

# Check if database copy is enabled
if [ "$COPY_SOURCE_DATABASE" != "true" ]; then
    echo "Database copy is disabled (COPY_SOURCE_DATABASE != true)"
    echo "Skipping database copy step"
    exit 0
fi

# Validate required environment variables
if [ -z "$SOURCE_DATABASE_URI" ]; then
    echo "ERROR: SOURCE_DATABASE_URI is not set"
    echo "This variable must point to the database to copy from"
    exit 1
fi

if [ -z "$DATABASE_URI" ]; then
    echo "ERROR: DATABASE_URI is not set"
    echo "This variable must point to the target database"
    exit 1
fi

echo "Source Database: $SOURCE_DATABASE_URI"
echo "Target Database: $DATABASE_URI"

# Parse database URIs to extract connection details
# Format: postgresql://user:password@host:port/database

parse_postgres_uri() {
    local uri=$1
    local prefix=""
    
    # Check for both postgres:// and postgresql:// prefixes
    if echo "$uri" | grep -q "^postgresql://"; then
        prefix="postgresql://"
    elif echo "$uri" | grep -q "^postgres://"; then
        prefix="postgres://"
    else
        echo "ERROR: Invalid PostgreSQL URI format: $uri"
        exit 1
    fi
    
    # Remove prefix
    uri=${uri#$prefix}
    
    # Extract user:password@host:port/database
    local userpass_hostport_db=$uri
    
    # Extract database name (after last /)
    local db_name=$(echo "$userpass_hostport_db" | sed 's/.*\///')
    
    # Extract userpass_hostport (before last /)
    local userpass_hostport=$(echo "$userpass_hostport_db" | sed 's/\(.*\)\/.*/\1/')
    
    # Extract host:port (after @)
    local host_port=$(echo "$userpass_hostport" | sed 's/.*@//')
    
    # Extract user:password (before last @)
    local user_pass=$(echo "$userpass_hostport" | sed 's/\(.*\)@.*/\1/')
    
    # Extract user (before :)
    local user=$(echo "$user_pass" | sed 's/:.*//')
    
    # Extract password (after :)
    local password=$(echo "$user_pass" | sed 's/[^:]*://')
    
    # Extract host (before :)
    local host=$(echo "$host_port" | sed 's/:.*//')
    
    # Extract port (after :), default to 5432 if not present
    local port=$(echo "$host_port" | grep -o ':[0-9]*$' | sed 's/://')
    if [ -z "$port" ]; then
        port=5432
    fi
    
    echo "$user|$password|$host|$port|$db_name"
}

# Parse source and target URIs
SOURCE_PARSED=$(parse_postgres_uri "$SOURCE_DATABASE_URI")
TARGET_PARSED=$(parse_postgres_uri "$DATABASE_URI")

SOURCE_USER=$(echo "$SOURCE_PARSED" | cut -d'|' -f1)
SOURCE_PASSWORD=$(echo "$SOURCE_PARSED" | cut -d'|' -f2)
SOURCE_HOST=$(echo "$SOURCE_PARSED" | cut -d'|' -f3)
SOURCE_PORT=$(echo "$SOURCE_PARSED" | cut -d'|' -f4)
SOURCE_DB=$(echo "$SOURCE_PARSED" | cut -d'|' -f5)

TARGET_USER=$(echo "$TARGET_PARSED" | cut -d'|' -f1)
TARGET_PASSWORD=$(echo "$TARGET_PARSED" | cut -d'|' -f2)
TARGET_HOST=$(echo "$TARGET_PARSED" | cut -d'|' -f3)
TARGET_PORT=$(echo "$TARGET_PARSED" | cut -d'|' -f4)
TARGET_DB=$(echo "$TARGET_PARSED" | cut -d'|' -f5)

echo "Source: $SOURCE_USER@$SOURCE_HOST:$SOURCE_PORT/$SOURCE_DB"
echo "Target: $TARGET_USER@$TARGET_HOST:$TARGET_PORT/$TARGET_DB"

# Guard against source and target being the exact same database
if [ "$SOURCE_HOST" = "$TARGET_HOST" ] && [ "$SOURCE_PORT" = "$TARGET_PORT" ] && [ "$SOURCE_DB" = "$TARGET_DB" ]; then
    echo "Source and target are the same database ($SOURCE_DB@$SOURCE_HOST:$SOURCE_PORT)"
    echo "Skipping database copy to avoid dropping production data"
    exit 0
fi

# Export PGPASSWORD for psql/createdb commands
export PGPASSWORD="$TARGET_PASSWORD"

# Check if target database already exists
echo "Checking if target database '$TARGET_DB' exists..."
DB_EXISTS=$(psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
    if [ "$FORCE_DATABASE_COPY" = "true" ]; then
        echo "Target database exists. FORCE_DATABASE_COPY=true, dropping and recreating..."
        
        # Terminate existing connections to the target database
        psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d postgres -c "
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = '$TARGET_DB' 
              AND pid <> pg_backend_pid();
        " || true
        
        # Drop the database
        psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"
    else
        echo "Target database already exists and FORCE_DATABASE_COPY is not true"
        echo "Skipping database copy step"
        exit 0
    fi
fi

# Check if source and target are on the same server
if [ "$SOURCE_HOST" = "$TARGET_HOST" ] && [ "$SOURCE_PORT" = "$TARGET_PORT" ]; then
    echo "Source and target are on the same PostgreSQL server"

    # --- Fix For ERROR:  source database "pragmatic_papers" is being accessed by other users ---
    echo "Terminating existing connections to source database '$SOURCE_DB'..."
    psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d postgres -c "
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = '$SOURCE_DB' 
          AND pid <> pg_backend_pid();
    " || true
    # ---------------------

    echo "Using CREATE DATABASE WITH TEMPLATE for efficient copy..."
    
    # Create database from template (most efficient method)
    psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d postgres -c "
        CREATE DATABASE \"$TARGET_DB\" 
        WITH TEMPLATE \"$SOURCE_DB\" 
        OWNER \"$TARGET_USER\";
    "
    
    echo "Database copied successfully using template method"
else
    echo "Source and target are on different servers"
    echo "Using pg_dump and pg_restore for cross-server copy..."
    
    # Create empty target database
    psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d postgres -c "
        CREATE DATABASE \"$TARGET_DB\" 
        OWNER \"$TARGET_USER\";
    "
    
    # Use pg_dump to dump and restore
    # Set PGPASSWORD for source connection
    export PGPASSWORD="$SOURCE_PASSWORD"
    
    pg_dump -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" \
        --format=custom --no-owner --no-acl | \
    PGPASSWORD="$TARGET_PASSWORD" pg_restore -h "$TARGET_HOST" -p "$TARGET_PORT" \
        -U "$TARGET_USER" -d "$TARGET_DB" --no-owner --no-acl
    
    echo "Database copied successfully using dump/restore method"
fi

echo "========================================"
echo "Database copy completed successfully"
echo "========================================"
