#!/usr/bin/env bash
# #916: how a page and a client-side navigation perform through Cloudflare today, from the
# cache and from the origin. Prints the median server wait (time to first byte minus the
# TCP/TLS setup) and the cf-cache-status counts for each kind of request.
#
#   scripts/bench-cache.sh https://pragmaticpapers.com /articles/<slug> [samples]
#
# A random query parameter forces a cache miss. With only `RSC: 1` sent, Next expects an
# empty `_rsc`, so `?x=..&_rsc` is a valid navigation request rather than a redirect;
# a real navigation's `_rsc` differs by the page it came from, which is #916's problem.
set -euo pipefail
H=$1 A=$2 N=${3:-10}
headers=$(mktemp)
trap 'rm -f "$headers"' EXIT

probe() { # label, url ({R} becomes a fresh random value per sample), extra curl args...
  local label=$1 url=$2
  shift 2
  for _ in $(seq 1 "$N"); do
    local u=${url//\{R\}/$RANDOM$RANDOM}
    curl -s -o /dev/null --max-time 60 -D "$headers" \
      -w "%{time_starttransfer} %{time_pretransfer}\n" "$@" "$u" |
      awk -v s="$(grep -i '^cf-cache-status' "$headers" | tr -d '\r' | awk '{print $2}')" \
        '{print $1 - $2, (s == "" ? "none" : s)}'
  done | sort -n | awk -v l="$label" '{t[NR] = $1; c[$2]++}
    END {
      printf "%-34s median %5.0f ms  min %5.0f  max %5.0f  [", l, t[int((NR + 1) / 2)] * 1000, t[1] * 1000, t[NR] * 1000
      for (k in c) printf " %s=%d", k, c[k]
      print " ]"
    }'
}

probe "home, full page" "$H/"
probe "article, full page" "$H$A"
probe "article, full page, cache miss" "$H$A?bench={R}"
probe "article, client nav, cache miss" "$H$A?bench={R}&_rsc" -H "RSC: 1"
probe "article, client nav, repeat" "$H$A?_rsc" -H "RSC: 1"
