#!/bin/sh
set -e

# Gives a preview deployment its own copy of the database it would otherwise share,
# so its migrations can't touch that database.
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

# psql, pg_dump and pg_restore take URIs whole, so the password never lands in a
# variable or the log.
ADMIN_URI=$(uri_with_database "$DATABASE_URI" postgres)
SOURCE_URI=$(uri_with_database "$DATABASE_URI" "$SOURCE_DB")

database_exists() {
    [ "$(psql "$ADMIN_URI" -tAc "SELECT 1 FROM pg_database WHERE datname='$1'" 2>/dev/null)" = "1" ]
}

# Drops database $1, disconnecting its clients first. A pool can reconnect between
# the two statements, so retry a few times.
drop_database() {
    for attempt in 1 2 3 4 5; do
        psql "$ADMIN_URI" -c "
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = '$1'
              AND pid <> pg_backend_pid();
        " >/dev/null || true
        if psql "$ADMIN_URI" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$1\";"; then
            return 0
        fi
        echo "Could not drop '$1' (attempt $attempt); retrying..."
        sleep 1
    done
    echo "ERROR: could not drop database '$1'"
    exit 1
}

# pg_dump refuses to dump a server of a newer major version, and a newer pg_dump writes
# settings (PostgreSQL 17's transaction_timeout, say) that an older server's restore
# rejects. The builder's client is the Dockerfile's pinned postgresqlNN-client, so check it
# matches the server before creating anything, and print both for the build log.
check_client_version() {
    server_major=$(( $(psql "$ADMIN_URI" -tAc "SHOW server_version_num") / 10000 ))
    client_major=$(pg_dump --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/')
    echo "pg_dump major version: $client_major; server: $server_major"
    if [ "$client_major" != "$server_major" ]; then
        echo "ERROR: pg_dump $client_major can't reliably copy a PostgreSQL $server_major database."
        echo "Install postgresql${server_major}-client in the Dockerfile's builder stage."
        exit 1
    fi
}

# Creates database $1 as a copy of the source.
#
# Never disconnects the source's clients: the source is staging, and killing them
# fails whatever staging is serving at that moment with "terminating connection due
# to administrator command" (#1057). A template copy needs the source to have no
# connections, so it's only tried as the fast path; while staging's app is connected
# Postgres refuses it straight away and the copy falls back to pg_dump/pg_restore.
copy_database() {
    echo "Trying CREATE DATABASE WITH TEMPLATE..."
    if psql "$ADMIN_URI" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$1\" WITH TEMPLATE \"$SOURCE_DB\";"; then
        echo "Copied with CREATE DATABASE WITH TEMPLATE"
        return 0
    fi
    echo "Template copy unavailable (the source is in use); falling back to dump/restore"
    check_client_version

    psql "$ADMIN_URI" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$1\";"
    # Through a file rather than a pipe: sh has no pipefail, so a failing pg_dump
    # would otherwise go unnoticed.
    dump=$(mktemp)
    if pg_dump --format=custom --no-owner --no-acl --file="$dump" --dbname="$SOURCE_URI" &&
        pg_restore --no-owner --no-acl --dbname="$(uri_with_database "$DATABASE_URI" "$1")" "$dump"; then
        rm -f "$dump"
        echo "Copied with pg_dump/pg_restore"
        return 0
    fi
    rm -f "$dump"
    # Left behind, the half-restored database would "exist" to the next build, which
    # would then keep it instead of copying.
    drop_database "$1"
    echo "ERROR: pg_dump/pg_restore failed"
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
    DATABASE_URI=$(uri_with_database "$DATABASE_URI" "$STAGE_DB") pnpm payload migrate

    echo "Swapping '$STAGE_DB' in for '$TARGET_DB'..."
    drop_database "$TARGET_DB"
    psql "$ADMIN_URI" -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$STAGE_DB\" RENAME TO \"$TARGET_DB\";"
else
    copy_database "$TARGET_DB"
fi

echo "========================================"
echo "Database copy completed successfully"
echo "========================================"
