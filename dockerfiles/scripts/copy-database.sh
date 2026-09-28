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

# psql against the target server's maintenance database, failing on the first error
target_psql() {
    psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

database_exists() {
    [ "$(target_psql -tAc "SELECT 1 FROM pg_database WHERE datname='$1'" 2>/dev/null)" = "1" ]
}

# Creates database $1 as a copy of the source.
#
# Never terminates the source's connections: the source is staging, and killing them
# fails whatever staging is serving at that moment with "terminating connection due
# to administrator command" (#1057). A template copy needs the source to have no
# connections, so it's only tried as the fast path; while staging's app is connected
# it fails straight away and the copy falls back to dump/restore.
copy_database() {
    db=$1
    if [ "$SOURCE_HOST" = "$TARGET_HOST" ] && [ "$SOURCE_PORT" = "$TARGET_PORT" ]; then
        echo "Source and target are on the same PostgreSQL server; trying CREATE DATABASE WITH TEMPLATE..."
        if target_psql -c "CREATE DATABASE \"$db\" WITH TEMPLATE \"$SOURCE_DB\" OWNER \"$TARGET_USER\";"; then
            echo "Database copied successfully using template method"
            return 0
        fi
        echo "Template copy unavailable (the source is in use); falling back to dump/restore"
    fi

    echo "Using pg_dump and pg_restore..."
    target_psql -c "CREATE DATABASE \"$db\" OWNER \"$TARGET_USER\";"
    PGPASSWORD="$SOURCE_PASSWORD" pg_dump -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" \
        --format=custom --no-owner --no-acl | \
    pg_restore -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d "$db" --no-owner --no-acl
    echo "Database copied successfully using dump/restore method"
}

# Drops database $1, disconnecting its clients first. A pool can reconnect between
# the two statements, so retry a few times.
drop_database() {
    for attempt in 1 2 3 4 5; do
        target_psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$1' AND pid <> pg_backend_pid();" >/dev/null || true
        if target_psql -c "DROP DATABASE IF EXISTS \"$1\";"; then
            return 0
        fi
        echo "Could not drop '$1' (attempt $attempt); retrying..."
        sleep 1
    done
    echo "ERROR: could not drop database '$1'"
    exit 1
}

echo "Checking if target database '$TARGET_DB' exists..."
if database_exists "$TARGET_DB"; then
    if [ "$FORCE_DATABASE_COPY" != "true" ]; then
        echo "Target database already exists and FORCE_DATABASE_COPY is not true"
        echo "Skipping database copy step"
        exit 0
    fi

    # The previous deploy's container is still serving the target. Dropping it now would
    # leave that container on a missing database, and then on an unmigrated copy of the
    # source, until this build finishes or for good if it fails (#1057, #1058). So build
    # and migrate the new copy beside it, and swap it in only once it's ready.
    STAGE_DB="${TARGET_DB}_incoming"
    echo "Target database exists. FORCE_DATABASE_COPY=true, preparing a fresh copy in '$STAGE_DB'..."
    drop_database "$STAGE_DB"
    copy_database "$STAGE_DB"

    echo "Running migrations on '$STAGE_DB'..."
    DATABASE_URI="${DATABASE_URI%/*}/$STAGE_DB" pnpm payload migrate

    echo "Swapping '$STAGE_DB' in for '$TARGET_DB'..."
    drop_database "$TARGET_DB"
    target_psql -c "ALTER DATABASE \"$STAGE_DB\" RENAME TO \"$TARGET_DB\";"
else
    copy_database "$TARGET_DB"
fi

echo "========================================"
echo "Database copy completed successfully"
echo "========================================"
