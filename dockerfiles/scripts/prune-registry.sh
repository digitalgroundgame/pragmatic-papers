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
#   - every tag named after one of the newest KEEP_PER_BRANCH commits of each branch in
#     KEEP_BRANCHES (main). Production runs on another server, so `docker ps` here can't
#     see which tag it runs, and dev's deploys would otherwise crowd its tags out.
#   - the newest KEEP_OTHER tags that aren't a PR's (staging's), for rollbacks
#
# and deletes every other tag with the images it named (see "Deleting a tag" below), then
# garbage-collects the files no remaining image uses.
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
#   KEEP_BRANCHES       default main (space-separated)
#   KEEP_PER_BRANCH     default 5
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
KEEP_BRANCHES=${KEEP_BRANCHES-main}
KEEP_PER_BRANCH=${KEEP_PER_BRANCH:-5}

restart=false
cleanup() {
    rm -f "${env_file:-}" "${running:-}" "${plan:-}" "${unregister:-}" "${gc_log:-}"
    if [ "$restart" = true ]; then docker start "$container" >/dev/null && echo "Started $container"; fi
}
trap cleanup EXIT

echo "=== Pruning the registry ($(date -u '+%Y-%m-%d %H:%M:%S UTC')) ==="

container=${REGISTRY_CONTAINER:-}
if [ -z "$container" ]; then
    container=$(docker ps -a --format '{{.Names}}' | grep '^registry-' || true)
    if [ "$(echo "$container" | grep -c .)" != "1" ]; then
        echo "ERROR: expected one registry-* container, found: ${container:-none}. Set REGISTRY_CONTAINER."
        exit 1
    fi
fi

# The registry's environment. Its variables override its config file, and Coolify's
# template moves the storage with REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY, leaving
# /var/lib/registry an empty volume. Garbage collection runs with the same environment.
env_file=$(mktemp)
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container" | grep . > "$env_file" || true
root=$(sed -n 's/^REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY=//p' "$env_file" | tail -1)
root=${root:-/var/lib/registry}

storage=$(docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$root\"}}{{.Source}}{{end}}{{end}}" "$container")
repositories="$storage/docker/registry/v2/repositories"
if [ -z "$storage" ] || [ ! -d "$repositories" ]; then
    echo "ERROR: can't find $container's storage, $root in the container (looked for $repositories)"
    exit 1
fi
echo "Storage: $root in the container, $storage on this server"

# GETs $1 from the repository's GitHub API.
github() {
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" -H 'Accept: application/vnd.github+json' \
            "https://api.github.com/repos/$REPOSITORY/$1"
    else
        curl -fsS -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$REPOSITORY/$1"
    fi
}

# The open PRs' numbers, one per line. Each PR in the list has exactly one top-level
# "url" ending in /pulls/<n>, so counting those also tells when the last page is read.
open_prs() {
    page=1
    while :; do
        body=$(github "pulls?state=open&per_page=100&page=$page") || return 1
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

# Tags kept whatever else the plan says: those this server's containers run, whichever
# repository they're from, and the kept branches' newest commits. A commit list names
# each commit's parents and tree too; keeping those as well costs nothing.
docker ps --format '{{.Image}}' | sed 's/.*://' > "$running"
for branch in $KEEP_BRANCHES; do
    if ! commits=$(github "commits?sha=$branch&per_page=$KEEP_PER_BRANCH" |
        grep -o '"sha": *"[0-9a-f]\{40\}"' | grep -o '[0-9a-f]\{40\}') || [ -z "$commits" ]; then
        echo "ERROR: couldn't list $branch's commits; deleting nothing"
        exit 1
    fi
    echo "$commits" >> "$running"
    echo "Keeping $branch's newest $KEEP_PER_BRANCH commits' tags"
done

# The tags in directory $1, most recently pushed first. A tag's directory is created on
# its first push, but every push rewrites its current/link, so that's what's sorted.
tags_by_push() {
    ls -t "$1"/*/current/link 2>/dev/null | sed -e "s|^$1/||" -e 's|/current/link$||'
}

# Prints "keep <tag>" or "delete <tag>" for the tags in directory $1, newest first.
plan_tags() {
    tags_by_push "$1" | awk -v open="$(echo "$open" | tr '\n' ',')" -v newest="$newest_open" \
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

# Deleting a tag doesn't free its image: the image's manifest stays registered under the
# repository's _manifests/revisions, and garbage collection keeps everything a registered
# manifest refers to. `garbage-collect --delete-untagged` would unregister untagged ones
# itself, but it counts the platform manifests inside an image index as untagged, since
# no tag names them, and so breaks every index it keeps (distribution/distribution#3178).
# Coolify pushes indexes. So unregister the deleted tags' manifests here, with the
# manifests inside them, and garbage-collect without that flag.
#
# A manifest stays registered if a kept tag names it, or if an index that stays registered
# lists it (an unchanged platform image shared by an old build and a new one).

blob() { hex=${1#sha256:}; echo "$storage/docker/registry/v2/blobs/sha256/$(echo "$hex" | cut -c1-2)/$hex/data"; }

# The digests of the manifests an index lists; nothing for an image's manifest.
children() {
    grep -q '"manifests"' "$(blob "$1")" 2>/dev/null || return 0
    grep -o '"digest": *"sha256:[0-9a-f]*"' "$(blob "$1")" | grep -o 'sha256:[0-9a-f]*'
}

unregister=$(mktemp)
for manifests in $(awk '{ print $1 }' "$plan" | sed 's|/tags$||' | sort -u); do
    revisions="$manifests/revisions/sha256"
    doomed_list=$(mktemp)
    kept_list=$(mktemp)
    # Every manifest a deleted tag has named, current or earlier, and what they list.
    awk -v tags="$manifests/tags" '$1 == tags && $2 == "delete" { print $3 }' "$plan" | while read -r tag; do
        cat "$manifests/tags/$tag/current/link" 2>/dev/null && echo
        ls "$manifests/tags/$tag/index/sha256" 2>/dev/null | sed 's/^/sha256:/'
    done | grep . | sort -u > "$doomed_list.top" || true
    while read -r digest; do echo "$digest"; children "$digest"; done < "$doomed_list.top" | sort -u > "$doomed_list"
    # What stays: the kept tags' manifests, every registered manifest that isn't doomed,
    # and whatever the indexes among them list.
    {
        awk -v tags="$manifests/tags" '$1 == tags && $2 == "keep" { print $3 }' "$plan" | while read -r tag; do
            cat "$manifests/tags/$tag/current/link" 2>/dev/null && echo
        done
        ls "$revisions" 2>/dev/null | sed 's/^/sha256:/' | grep -vxF -f "$doomed_list"
    } | grep . | sort -u > "$kept_list.top" || true
    while read -r digest; do echo "$digest"; children "$digest"; done < "$kept_list.top" | sort -u > "$kept_list"
    grep -vxF -f "$kept_list" "$doomed_list" | while read -r digest; do
        [ -d "$revisions/${digest#sha256:}" ] && echo "$revisions/${digest#sha256:}"
    done >> "$unregister" || true
    rm -f "$doomed_list" "$doomed_list.top" "$kept_list" "$kept_list.top"
done
manifest_count=$(grep -c . "$unregister" || true)

if [ "$doomed" -eq 0 ]; then
    echo "Nothing to delete"
    exit 0
fi
if [ "$APPLY" != true ]; then
    echo "Dry run: would delete $doomed of $total tags and unregister their $manifest_count manifests."
    echo "Re-run with --apply to delete them."
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
while read -r revision; do rm -rf "${revision:?}"; done < "$unregister"
echo "Deleted $doomed tags and unregistered $manifest_count manifests; collecting garbage..."
# Through a file rather than a pipe: sh has no pipefail, so a failure would go unnoticed.
gc_log=$(mktemp)
if ! docker run --rm --volumes-from "$container" --env-file "$env_file" --entrypoint registry "$image" \
    garbage-collect "$CONFIG" > "$gc_log" 2>&1; then
    tail -20 "$gc_log"
    echo "ERROR: garbage collection failed; the tags are deleted, and the next run collects their files"
    exit 1
fi
tail -3 "$gc_log"
echo "After: $(du -sh "$storage" | cut -f1)"
