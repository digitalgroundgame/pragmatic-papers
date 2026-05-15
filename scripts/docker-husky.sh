#!/bin/sh
set -e

docker compose -p pragmatic-papers -f docker-compose.yml run --rm --no-deps --build app sh -lc "
  git config --global --add safe.directory /app &&
  pnpm config set store-dir /pnpm/store &&
  CI=true pnpm install --frozen-lockfile --network-concurrency=4 &&
  $*
"
