#!/bin/sh
set -e

# Gives a preview deployment its own copy of the database it would otherwise share,
# so its migrations can't touch that database. Reads the source without
# disconnecting anyone from it.
#
# Run after use_preview_database (database-uri.sh): DATABASE_URI then points at the
# preview's database and SOURCE_DATABASE_NAME names the one to copy, on the same
# server, reached with the same credentials.

echo "========================================"
echo "Database Copy Script for Preview Builds"
echo "========================================"

if [ "$COPY_SOURCE_DATABASE" != "true" ]; then
    echo "Database copy is disabled (COPY_SOURCE_DATABASE != true)"
    echo "Skipping database copy step"
    exit 0
fi

if [ -z "$DATABASE_URI" ]; then
    echo "ERROR: DATABASE_URI is not set"
    exit 1
fi

. "$(dirname "$0")/database-uri.sh"

SOURCE_DB=$SOURCE_DATABASE_NAME
TARGET_DB=$(uri_database "$DATABASE_URI")

if [ -z "$SOURCE_DB" ] || [ "$SOURCE_DB" = "$TARGET_DB" ]; then
    echo "DATABASE_URI isn't a preview database ($TARGET_DB)"
    echo "Skipping database copy to avoid dropping its data"
    exit 0
fi

echo "Source database: $SOURCE_DB"
echo "Target database: $TARGET_DB"

# psql takes the URI whole, so its password never lands in a variable or the log.
ADMIN_URI=$(uri_with_database "$DATABASE_URI" postgres)

echo "Checking if target database '$TARGET_DB' exists..."
DB_EXISTS=$(psql "$ADMIN_URI" -tAc "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
    if [ "$FORCE_DATABASE_COPY" = "true" ]; then
        echo "Target database exists. FORCE_DATABASE_COPY=true, dropping and recreating..."

        psql "$ADMIN_URI" -c "
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = '$TARGET_DB'
              AND pid <> pg_backend_pid();
        " || true

        psql "$ADMIN_URI" -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"
    else
        echo "Target database already exists and FORCE_DATABASE_COPY is not true"
        echo "Skipping database copy step"
        exit 0
    fi
fi

# Stream the source in with pg_dump rather than CREATE DATABASE ... TEMPLATE: a
# template copy needs every other session off the source, and the source is the
# live database staging is connected to. pg_dump reads a consistent snapshot over
# an ordinary connection instead, taking only read locks.
SOURCE_URI=$(uri_with_database "$DATABASE_URI" "$SOURCE_DB")

echo "Creating empty database '$TARGET_DB'..."
psql "$ADMIN_URI" -c "CREATE DATABASE \"$TARGET_DB\";"

echo "Copying '$SOURCE_DB' into it with pg_dump | pg_restore..."
# Alpine's sh has no pipefail, so pg_dump's exit status travels through a file.
dump_status=$(mktemp)
trap 'rm -f "$dump_status"' EXIT
restore_status=0
{ pg_dump --format=custom --no-owner --no-acl "$SOURCE_URI"; echo $? > "$dump_status"; } |
    pg_restore --no-owner --no-acl --exit-on-error --single-transaction -d "$DATABASE_URI" ||
    restore_status=$?

if [ "$(cat "$dump_status")" != "0" ] || [ "$restore_status" != "0" ]; then
    # Drop the partial copy, or the next build would find it and skip the copy.
    echo "ERROR: copying '$SOURCE_DB' failed; dropping '$TARGET_DB' so the next build retries"
    psql "$ADMIN_URI" -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";" || true
    exit 1
fi

echo "========================================"
echo "Database copy completed successfully"
echo "========================================"
