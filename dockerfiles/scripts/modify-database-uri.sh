#!/bin/sh
set -e

# Names the database a preview deployment uses: DATABASE_URI's database with the
# PR prefix of COOLIFY_FQDN appended (pragmatic_papers -> pragmatic_papers_pr_330).
#
# Only the name is written, to $DATABASE_NAME_FILE (default /tmp/database_name), and
# never the URI: the runner image carries this file, and start.sh applies it to the
# DATABASE_URI Coolify passes at runtime, so no credential is baked into the image.
# The file is empty outside previews, which then use DATABASE_URI as-is.

. "$(dirname "$0")/database-uri.sh"

NAME_FILE=${DATABASE_NAME_FILE:-/tmp/database_name}
: > "$NAME_FILE"

echo "========================================"
echo "Database URI Modifier"
echo "========================================"

if [ "$BUILD_ENV" != "preview" ]; then
    echo "BUILD_ENV is not 'preview' (current: ${BUILD_ENV:-not set})"
    echo "Skipping DATABASE_URI modification"
    echo "DATABASE_URI: $(redact_uri "$DATABASE_URI")"
    exit 0
fi

echo "BUILD_ENV: preview - proceeding with DATABASE_URI modification"

if [ -z "$COOLIFY_FQDN" ]; then
    echo "COOLIFY_FQDN is not set, using DATABASE_URI as-is"
    echo "DATABASE_URI: $(redact_uri "$DATABASE_URI")"
    exit 0
fi

echo "COOLIFY_FQDN: $COOLIFY_FQDN"

if [ -z "$DATABASE_URI" ]; then
    echo "ERROR: DATABASE_URI is not set"
    exit 1
fi

case "$DATABASE_URI" in
    postgres://* | postgresql://*) ;;
    *)
        echo "ERROR: DATABASE_URI must start with postgresql:// or postgres://"
        exit 1
        ;;
esac

# "pr-330.pragmaticpapers.com" -> "pr_330" (hyphens aren't safe in database names)
SUFFIX=$(echo "$COOLIFY_FQDN" | cut -d'.' -f1 | tr '-' '_')
NEW_DB_NAME="$(uri_database "$DATABASE_URI")_${SUFFIX}"

echo "$NEW_DB_NAME" > "$NAME_FILE"

echo "Original DATABASE_URI: $(redact_uri "$DATABASE_URI")"
echo "Modified DATABASE_URI: $(redact_uri "$(uri_with_database "$DATABASE_URI" "$NEW_DB_NAME")")"

echo "========================================"
echo "Database URI modification complete"
echo "========================================"
