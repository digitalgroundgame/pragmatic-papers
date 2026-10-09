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
# to administrator command". A template copy needs the source to have no
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

# An image built in GitHub Actions runs this at every container start, not once per
# build, so a restart of the same image must not take FORCE_DATABASE_COPY as a request
# for another fresh copy: that would throw away what testers entered. The commit a copy
# was made for is kept as the database's comment, and a forced copy is made once per
# commit. The image carries it as IMAGE_COMMIT: Coolify sets SOURCE_COMMIT=HEAD on a
# Docker Image app's container, which would make every image look like the last one.
FORCED_MARK="copied for commit ${IMAGE_COMMIT}"
copied_for_this_commit() {
    [ "$BUILT_WITHOUT_DATABASE" = "true" ] && [ -n "$IMAGE_COMMIT" ] &&
        [ "$(psql "$ADMIN_URI" -tAc "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname='$1'")" = "$FORCED_MARK" ]
}
mark_copied() {
    if [ "$BUILT_WITHOUT_DATABASE" = "true" ] && [ -n "$IMAGE_COMMIT" ]; then
        psql "$ADMIN_URI" -v ON_ERROR_STOP=1 -c "COMMENT ON DATABASE \"$1\" IS '$FORCED_MARK';"
    fi
}

# The migrations this image ships, one name per line, written by the Dockerfile that built
# it. Without the file, a preview database is only replaced when FORCE_DATABASE_COPY says so.
MIGRATION_NAMES_FILE=${MIGRATION_NAMES_FILE:-$(dirname "$0")/migration_names}

# Prints the migrations database $1 has run that neither this image nor the source has: one
# an earlier commit of the PR added and a later one renamed, rebuilt or dropped. Payload
# would apply the new version over what the old one left and fail, so the copy is stale.
# Migrations the source has run are expected (staging can be ahead of the PR), as are the
# image's own.
stale_migrations() {
    [ -f "$MIGRATION_NAMES_FILE" ] || return 0
    target_ran=$(psql "$(uri_with_database "$DATABASE_URI" "$1")" -tAc "SELECT name FROM payload_migrations" 2>/dev/null) || return 0
    source_ran=$(psql "$SOURCE_URI" -tAc "SELECT name FROM payload_migrations" 2>/dev/null) || return 0
    printf '%s\n' "$target_ran" | while read -r name; do
        [ -n "$name" ] || continue
        grep -qxF "$name" "$MIGRATION_NAMES_FILE" && continue
        printf '%s\n' "$source_ran" | grep -qxF "$name" && continue
        echo "$name"
    done
}

echo "Checking if target database '$TARGET_DB' exists..."
if database_exists "$TARGET_DB"; then
    stale=$(stale_migrations "$TARGET_DB")
    if [ -n "$stale" ]; then
        echo "'$TARGET_DB' has run migrations that this image and '$SOURCE_DB' don't have:"
        printf '  %s\n' $stale
        echo "Replacing it with a fresh copy, as FORCE_DATABASE_COPY=true would"
        FORCE_DATABASE_COPY=true
    fi
    if [ "$FORCE_DATABASE_COPY" != "true" ]; then
        echo "Target database already exists and FORCE_DATABASE_COPY is not true"
        echo "Skipping database copy step"
        exit 0
    fi
    if copied_for_this_commit "$TARGET_DB"; then
        echo "Target database was already copied for this image (${IMAGE_COMMIT}); a restart keeps its data"
        echo "Skipping database copy step"
        exit 0
    fi

    # The previous deploy's container is still serving the target. Dropping it now would
    # leave that container on a missing database, and then on an unmigrated copy of the
    # source, until this build finishes or for good if it fails. So build
    # and migrate the new copy beside it, and swap it in only once it's ready.
    STAGE_DB="${TARGET_DB}_incoming"
    echo "Target database exists. FORCE_DATABASE_COPY=true, preparing a fresh copy in '$STAGE_DB'..."
    drop_database "$STAGE_DB"
    copy_database "$STAGE_DB"

    # An image built in GitHub Actions runs this at start and has no Payload CLI: the
    # app migrates the database once it's swapped in, before its health check passes, so
    # the old container serves the unmigrated copy for that long.
    if [ "$BUILT_WITHOUT_DATABASE" = "true" ]; then
        echo "Leaving '$STAGE_DB' for the app to migrate when it starts"
    else
        echo "Running migrations on '$STAGE_DB'..."
        DATABASE_URI=$(uri_with_database "$DATABASE_URI" "$STAGE_DB") pnpm payload migrate
    fi

    echo "Swapping '$STAGE_DB' in for '$TARGET_DB'..."
    drop_database "$TARGET_DB"
    psql "$ADMIN_URI" -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$STAGE_DB\" RENAME TO \"$TARGET_DB\";"
else
    copy_database "$TARGET_DB"
fi
mark_copied "$TARGET_DB"

echo "========================================"
echo "Database copy completed successfully"
echo "========================================"
