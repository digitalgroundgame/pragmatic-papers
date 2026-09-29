#!/bin/sh
# Deletes old images from the Docker registry Coolify pushes our builds to, and frees
# their space. Run on the server that hosts the registry, from root's crontab:
#
#   30 4 * * * /root/prune-registry.sh --apply >> /var/log/prune-registry.log 2>&1
#
# Without --apply it only prints what it would delete.
#
# Every deploy pushes a tag (`pr-<n>-<sha>` for a preview), and a registry never deletes
# anything on its own, so they piled up: 224 tags and 6.5 GB on dev-worker. It keeps:
#
#   - every tag a container on this server is running
#   - the newest KEEP_PER_PR tags of each open PR, and every tag of a PR newer than all
#     the open PRs GitHub listed (it may be too new to be listed yet)
#   - the newest KEEP_OTHER tags that aren't a PR's (staging's and production's), for
#     rollbacks and for servers other than this one that run them
#
# and deletes every other tag, then garbage-collects the files no tag uses any more.
# The registry is stopped while it does, so a push can't land half-collected; a deploy
# that pushes in that minute fails and needs redeploying.
#
# If it can't tell which PRs are open, it deletes nothing.
#
# Settings (environment variables):
#   REGISTRY_CONTAINER  the registry's container; defaults to the only one named registry-*
#   REGISTRY_CONFIG     its config file inside the container (/etc/docker/registry/config.yml)
#   GITHUB_REPOSITORY   the repository whose PRs these are (digitalgroundgame/pragmatic-papers)
#   GITHUB_TOKEN        optional; only needed if the repository is private
#   KEEP_PER_PR         default 2
#   KEEP_OTHER          default 10
set -eu

APPLY=false
case "${1:-}" in
    --apply) APPLY=true ;;
    "") ;;
    *) echo "Usage: $0 [--apply]" >&2; exit 2 ;;
esac

REPOSITORY=${GITHUB_REPOSITORY:-digitalgroundgame/pragmatic-papers}
CONFIG=${REGISTRY_CONFIG:-/etc/docker/registry/config.yml}
KEEP_PER_PR=${KEEP_PER_PR:-2}
KEEP_OTHER=${KEEP_OTHER:-10}

echo "=== Pruning the registry ($(date -u '+%Y-%m-%d %H:%M:%S UTC')) ==="

container=${REGISTRY_CONTAINER:-}
if [ -z "$container" ]; then
    container=$(docker ps -a --format '{{.Names}}' | grep '^registry-' || true)
    if [ "$(echo "$container" | grep -c .)" != "1" ]; then
        echo "ERROR: expected one registry-* container, found: ${container:-none}. Set REGISTRY_CONTAINER."
        exit 1
    fi
fi

storage=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/registry"}}{{.Source}}{{end}}{{end}}' "$container")
repositories="$storage/docker/registry/v2/repositories"
if [ -z "$storage" ] || [ ! -d "$repositories" ]; then
    echo "ERROR: can't find $container's storage (looked for $repositories)"
    exit 1
fi

# The open PRs' numbers, one per line. Each PR in the list has exactly one top-level
# "url" ending in /pulls/<n>, so counting those also tells when the last page is read.
open_prs() {
    page=1
    while :; do
        if [ -n "${GITHUB_TOKEN:-}" ]; then
            body=$(curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" -H 'Accept: application/vnd.github+json' \
                "https://api.github.com/repos/$REPOSITORY/pulls?state=open&per_page=100&page=$page") || return 1
        else
            body=$(curl -fsS -H 'Accept: application/vnd.github+json' \
                "https://api.github.com/repos/$REPOSITORY/pulls?state=open&per_page=100&page=$page") || return 1
        fi
        numbers=$(echo "$body" | grep -o "\"url\": *\"https://api.github.com/repos/$REPOSITORY/pulls/[0-9]*\"" |
            grep -o '[0-9]*"$' | tr -d '"')
        [ -n "$numbers" ] && echo "$numbers"
        [ "$(echo "$numbers" | grep -c .)" -lt 100 ] && return 0
        page=$((page + 1))
    done
}

if ! open=$(open_prs) || [ -z "$open" ]; then
    echo "ERROR: couldn't list $REPOSITORY's open PRs; deleting nothing"
    exit 1
fi
newest_open=$(echo "$open" | sort -n | tail -1)
echo "Open PRs: $(echo "$open" | sort -n | tr '\n' ' ')"

running=$(mktemp)
plan=$(mktemp)
restart=false
cleanup() {
    rm -f "$running" "$plan" "${gc_log:-}"
    if [ "$restart" = true ]; then docker start "$container" >/dev/null && echo "Started $container"; fi
}
trap cleanup EXIT

# The tags this server's containers run, whichever repository they're from.
docker ps --format '{{.Image}}' | sed 's/.*://' > "$running"

# Prints "keep <tag>" or "delete <tag>" for the tags in directory $1, newest first.
plan_tags() {
    ls -t "$1" | awk -v open="$(echo "$open" | tr '\n' ',')" -v newest="$newest_open" \
        -v per_pr="$KEEP_PER_PR" -v other="$KEEP_OTHER" '
        BEGIN { n = split(open, prs, ","); for (i = 1; i <= n; i++) if (prs[i] != "") is_open[prs[i]] = 1 }
        match($0, /^pr-[0-9]+-/) {
            pr = substr($0, 4, RLENGTH - 4) + 0
            print ((pr > newest || (pr in is_open && ++kept[pr] <= per_pr)) ? "keep" : "delete"), $0
            next
        }
        { print (++others <= other ? "keep" : "delete"), $0 }' |
        while read -r action tag; do
            if [ "$action" = delete ] && grep -qxF "$tag" "$running"; then action=keep; fi
            echo "$action $tag"
        done
}

total=0
doomed=0
for manifests in $(find "$repositories" -type d -name _manifests); do
    tags="$manifests/tags"
    [ -d "$tags" ] || continue
    name=${manifests#"$repositories"/}
    name=${name%/_manifests}
    plan_tags "$tags" | sed "s|^|$tags |" >> "$plan"
    count=$(ls "$tags" | wc -l)
    deleting=$(grep -c "^$tags delete " "$plan" || true)
    total=$((total + count))
    doomed=$((doomed + deleting))
    echo "$name: $count tags, deleting $deleting, keeping:"
    grep "^$tags keep " "$plan" | awk '{ print "  " $3 }'
done

if [ "$doomed" -eq 0 ]; then
    echo "Nothing to delete"
    exit 0
fi
if [ "$APPLY" != true ]; then
    echo "Dry run: would delete $doomed of $total tags. Re-run with --apply to delete them."
    exit 0
fi

echo "Before: $(du -sh "$storage" | cut -f1)"
image=$(docker inspect -f '{{.Config.Image}}' "$container")
if [ "$(docker inspect -f '{{.State.Running}}' "$container")" = true ]; then
    docker stop "$container" >/dev/null
    restart=true
    echo "Stopped $container"
fi

awk '$2 == "delete"' "$plan" | while read -r tags _ tag; do rm -rf "${tags:?}/${tag:?}"; done
echo "Deleted $doomed tags; collecting garbage..."
# Through a file rather than a pipe: sh has no pipefail, so a failure would go unnoticed.
gc_log=$(mktemp)
if ! docker run --rm --volumes-from "$container" --entrypoint registry "$image" \
    garbage-collect --delete-untagged "$CONFIG" > "$gc_log" 2>&1; then
    tail -20 "$gc_log"
    echo "ERROR: garbage collection failed; the tags are deleted, and the next run collects their files"
    exit 1
fi
tail -3 "$gc_log"
echo "After: $(du -sh "$storage" | cut -f1)"
