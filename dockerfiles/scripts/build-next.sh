#!/bin/sh
# Runs `pnpm build`, retrying once without the Turbopack cache if the cache is corrupt.
#
# .next/cache is a BuildKit cache mount shared by every build on the server. A build
# killed mid-compile (out of memory, a cancelled deploy) can leave it half-written, and
# every later build then fails within seconds with one of the storage errors below.
# Any other failure exits with its own status, without a retry.

CORRUPT_CACHE_ERRORS='Failed to restore (data|meta) for task|Failed to open database|Cache corruption detected|Unable to open static sorted file'

log=$(mktemp)
status_file=$(mktemp)
trap 'rm -f "$log" "$status_file"' EXIT

# Alpine's sh has no pipefail, so the exit status travels through a file.
{ pnpm build; echo $? > "$status_file"; } 2>&1 | tee "$log"
status=$(cat "$status_file")

[ "$status" -eq 0 ] && exit 0
grep -qE "$CORRUPT_CACHE_ERRORS" "$log" || exit "$status"

echo "--- Turbopack cache is corrupt: clearing it and rebuilding ---"
rm -rf .next/cache/turbopack
pnpm build
