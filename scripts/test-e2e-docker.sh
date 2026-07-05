#!/usr/bin/env bash
# Runs the E2E suite inside the same Playwright Docker image CI uses, so
# locally-generated screenshot baselines have (near-)exact parity with what
# CI produces — no more push-wait-auto-commit loop for routine baseline
# updates. See tests/e2e/README.md for the full lifecycle.
#
# Requires Docker with a running daemon. On Linux, --network host lets the
# container reach the Next.js server at localhost:8000 the same way the host
# process would; this does not work on Docker Desktop for Mac/Windows.
#
# node_modules is kept in a named volume rather than bind-mounted from the
# host, so `pnpm install` running inside the (Linux) container doesn't
# clobber host-platform native binaries (sharp, esbuild, etc.) in your
# working tree.
#
# Usage:
#   pnpm test:e2e:update-snapshots                       # --update-snapshots=changed
#   pnpm test:e2e:update-snapshots -- --update-snapshots=missing
#   pnpm test:e2e:update-snapshots -- --update-snapshots=changed --project=chromium tests/e2e/foo.spec.ts

set -euo pipefail

# Keep in sync with the `@playwright/test` version resolved in pnpm-lock.yaml
# and the image used by .github/workflows/playwright.yml.
IMAGE="mcr.microsoft.com/playwright:v1.60.0-noble"

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not reachable — start Docker and try again." >&2
  exit 1
fi

args=("$@")
if [ "${#args[@]}" -eq 0 ]; then
  args=("--update-snapshots=changed" "--project=chromium")
fi

docker run --rm \
  --network host \
  --ipc host \
  -v "$(pwd)":/work \
  -v pragmatic-papers-e2e-node-modules:/work/node_modules \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -w /work \
  -e PAYLOAD_SECRET="${PAYLOAD_SECRET:-test-secret-for-e2e-tests}" \
  -e NEXT_PUBLIC_SERVER_URL=http://localhost:8000 \
  -e USE_LOCAL_STORAGE=true \
  -e E2E_PROD_SERVER=true \
  "$IMAGE" \
  bash -c 'corepack enable && pnpm install --frozen-lockfile && node scripts/test-e2e.mjs "$@"' bash "${args[@]}"
