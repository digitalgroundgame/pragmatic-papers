#!/bin/sh
set -e

# The image carries no credentials, so the connection string comes only from the
# DATABASE_URI Coolify passes at runtime ("Runtime" must be ticked for it).
if [ -z "$DATABASE_URI" ]; then
    echo "ERROR: DATABASE_URI is not set at runtime (Coolify: enable Runtime for it)"
    exit 1
fi

# Every deployed image sets BUILD_ENV. Without SERVER_URL the app would put
# http://localhost:8000 in canonical tags, sitemaps and share links (#1090), so refuse
# to start: the healthcheck fails and Coolify keeps the previous container.
if [ -n "$BUILD_ENV" ] && [ -z "$SERVER_URL" ]; then
    echo "ERROR: SERVER_URL is not set at runtime (Coolify: enable Runtime for it)"
    exit 1
fi

# With S3 storage, media URLs point at SUPABASE_URL's public bucket S3_BUCKET, and
# next/image only optimizes them from a *.supabase.co host (next.config.ts). Anything else
# would break every image on the site (#791), so refuse to start, as above.
if [ -n "$BUILD_ENV" ] && [ "$USE_LOCAL_STORAGE" != "true" ]; then
    if [ -z "$S3_BUCKET" ]; then
        echo "ERROR: S3_BUCKET is not set at runtime, and USE_LOCAL_STORAGE isn't true (Coolify: enable Runtime for it)"
        exit 1
    fi
    case "$SUPABASE_URL" in
    https://*.supabase.co) ;;
    "")
        echo "ERROR: SUPABASE_URL is not set at runtime, and USE_LOCAL_STORAGE isn't true (Coolify: enable Runtime for it)"
        exit 1
        ;;
    *)
        echo "ERROR: SUPABASE_URL must be https://<project>.supabase.co with no trailing slash, the host next.config.ts lets next/image load; got $SUPABASE_URL"
        exit 1
        ;;
    esac
fi

# The helpers, and the database name a Coolify build chose, sit next to this script in /app.
APP_DIR=$(dirname "$0")
. "$APP_DIR/database-uri.sh"

if [ "$BUILT_WITHOUT_DATABASE" = "true" ]; then
    # Built in GitHub Actions (PragmaticPapers.ci.Dockerfile, #1067): the database work a
    # Coolify build does happens here instead, next to the database. Name the preview's
    # database from the runtime COOLIFY_FQDN, copy staging into it on its first boot, and
    # drop closed PRs' copies. Payload migrates it when it starts (prodMigrations).
    DATABASE_NAME_FILE=/tmp/database_name "$APP_DIR/modify-database-uri.sh"
    use_preview_database /tmp/database_name
    "$APP_DIR/copy-database.sh"
    node "$APP_DIR/drop-closed-preview-databases.ts"

    # The database copy brings staging's media rows but not their files, which live
    # in staging's storage. When the app mounts that at /staging-media, copy what this
    # preview's own media volume lacks. -n never overwrites, so the preview's own
    # uploads survive, and later starts only pick up what staging added since.
    # An empty mount means its source path is wrong, so Docker created a new folder.
    staging_media=${STAGING_MEDIA_DIR:-/staging-media}
    if [ -d "$staging_media" ] && [ -n "$(ls -A "$staging_media")" ]; then
        echo "--- Copying staging's media from $staging_media ---"
        if cp -Rn "$staging_media/." "$APP_DIR/public/media/"; then
            echo "Media: $(ls "$APP_DIR/public/media" | wc -l) files"
        else
            echo "WARNING: couldn't copy all of staging's media; some images may be missing"
        fi
    elif [ -d "$staging_media" ]; then
        # Docker creates a missing bind source as an empty root-owned folder, so this is
        # either a wrong source path or staging's media folder has been deleted.
        echo "ERROR: $staging_media is empty, so this preview gets none of staging's media."
        echo "  Either its mount's source path is wrong, or staging's own media folder is"
        echo "  gone (staging's files would then 500 too). See dockerfiles/README.md."
    fi
else
    # Preview deployments run on their own database: apply the name the build chose
    # (modify-database-uri.sh) to that DATABASE_URI.
    use_preview_database "$APP_DIR/database_name"
fi

# Local storage keeps every upload in public/media, which only a mount keeps across
# deploys. Say so at start rather than let each file 500 or each upload fail later.
if [ "$USE_LOCAL_STORAGE" = "true" ]; then
    media_dir="$APP_DIR/public/media"
    if [ ! -d "$media_dir" ]; then
        echo "WARNING: $media_dir doesn't exist; media files will 500 and uploads will fail"
    else
        if [ ! -w "$media_dir" ]; then
            echo "WARNING: $media_dir isn't writable by uid $(id -u), so uploads will fail."
            echo "  On the host, chown $(id -u):$(id -g) the folder its mount binds (dockerfiles/README.md)."
        fi
        if [ -z "$(ls -A "$media_dir")" ]; then
            echo "WARNING: $media_dir is empty; any media the database lists will 500."
            echo "  Check its mount in Coolify and that the host folder still holds the files."
        fi
    fi
fi

echo "========================================="
echo "Starting Pragmatic Papers Application"
echo "Node version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Database: PostgreSQL ($(uri_database "$DATABASE_URI"))"
echo "Port: $PORT"
echo "Hostname: $HOSTNAME"
echo "Storage: $([ "$USE_LOCAL_STORAGE" = "true" ] && echo "Local" || echo "S3")"
echo "========================================="

if [ "$BUILT_WITHOUT_DATABASE" != "true" ]; then
    echo "Starting Next.js server..."
    exec node server.js
fi

# The build prerendered its feeds from an empty database. Once the server answers (and
# so has started Payload and migrated), throw those away so they render from this one.
refresh_prerendered_routes() {
    url="http://127.0.0.1:${PORT:-3000}"
    tries=0
    until wget -q -O /dev/null "$url/api/users/me"; do
        tries=$((tries + 1))
        if [ "$tries" -ge 150 ]; then
            echo "WARNING: server not up after 5 min; prerendered routes keep the build's content"
            return 0
        fi
        sleep 2
    done
    if wget -q -O /dev/null --post-data="" \
        --header="Authorization: Bearer $PAYLOAD_SECRET" "$url/next/revalidate-all"; then
        echo "Prerendered routes refreshed from $(uri_database "$DATABASE_URI")"
    else
        echo "WARNING: couldn't refresh prerendered routes; they keep the build's content"
    fi
}

echo "Starting Next.js server..."
node server.js &
server=$!
# dumb-init already signals the whole process group; don't let the signal end this
# shell before the server has shut down.
trap 'kill -TERM "$server" 2>/dev/null || true' TERM INT
refresh_prerendered_routes &

set +e
wait "$server"
status=$?
# A trapped signal interrupts the first wait; wait again for the server to finish.
if kill -0 "$server" 2>/dev/null; then
    wait "$server"
    status=$?
fi
exit "$status"
