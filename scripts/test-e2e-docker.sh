#!/usr/bin/env bash
# Runs the E2E suite inside the same Playwright Docker image CI uses (see
# docker-compose.e2e.yml), so locally-generated screenshot baselines have
# parity with what CI produces — no more push-wait-auto-commit loop for
# routine baseline updates. See tests/e2e/README.md for the full lifecycle.
#
# Requires Docker with a running daemon (Docker Desktop is fine — no host
# networking or socket mounts involved). Postgres runs as a sibling compose
# service; the Next.js production server and Playwright run inside the
# pinned Playwright container.
#
# Usage:
#   pnpm test:e2e:update-snapshots                       # --update-snapshots=changed
#   pnpm test:e2e:update-snapshots -- --update-snapshots=missing
#   pnpm test:e2e:update-snapshots -- --update-snapshots=changed --project=chromium tests/e2e/foo.spec.ts

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -p pragmatic-papers-e2e -f docker-compose.e2e.yml)

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not reachable — start Docker and try again." >&2
  exit 1
fi

if [ -z "${GH_FONT_READ:-}" ]; then
  echo "⚠ GH_FONT_READ is not set — the private @digitalgroundgame/fonts package" >&2
  echo "  won't install, so screenshots will render with the fallback font and" >&2
  echo "  WILL NOT match CI baselines. Export GH_FONT_READ before generating" >&2
  echo "  baselines you intend to commit." >&2
fi

args=("$@")
if [ "${#args[@]}" -eq 0 ]; then
  args=("--update-snapshots=changed" "--project=chromium")
fi

cleanup() {
  "${COMPOSE[@]}" down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${COMPOSE[@]}" run --rm playwright \
  bash -c 'corepack enable && pnpm install --frozen-lockfile && node scripts/test-e2e.mjs "$@"' bash "${args[@]}"
