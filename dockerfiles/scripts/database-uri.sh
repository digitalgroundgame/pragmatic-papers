# DATABASE_URI helpers, sourced by the build and start scripts.
# A URI looks like postgres://user:password@host:port/database?options

# Never print a URI as-is: it carries the database password.
redact_uri() {
    echo "$1" | sed -E 's#^([a-z]+://[^:@/]*):.*@#\1:****@#'
}

# The URI's database name.
uri_database() {
    base=${1%%\?*}
    echo "${base##*/}"
}

# The URI with its database swapped for $2, keeping any ?options.
uri_with_database() {
    base=${1%%\?*}
    echo "${base%/*}/$2${1#"$base"}"
}

# Points DATABASE_URI at the preview database named in file $1, when it names one,
# and keeps the database it replaced in SOURCE_DATABASE_NAME for copy-database.sh.
use_preview_database() {
    [ -s "$1" ] || return 0
    SOURCE_DATABASE_NAME=$(uri_database "$DATABASE_URI")
    DATABASE_URI=$(uri_with_database "$DATABASE_URI" "$(cat "$1")")
    export SOURCE_DATABASE_NAME DATABASE_URI
}
