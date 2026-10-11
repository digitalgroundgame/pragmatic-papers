#!/usr/bin/env bash
# Waits for this run's "Build image" job, then downloads its `app-image`
# artifact and loads it into Docker. playwright.yml's E2E job runs it from
# scripts/test-e2e.mjs (E2E_IMAGE_WAIT), after seeding, so pulling its
# container, installing and seeding happen while the image builds rather than
# after. Needs GH_TOKEN with `actions: read`, and the gh and docker CLIs.
set -euo pipefail

job="Build image"
jobs_url="repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/attempts/${GITHUB_RUN_ATTEMPT:-1}/jobs?per_page=100"
deadline=$((SECONDS + ${WAIT_TIMEOUT_SECONDS:-2100}))

echo "Waiting for the $job job..."
while :; do
  state=$(gh api "$jobs_url" --jq ".jobs[] | select(.name == \"$job\") | \"\(.status) \(.conclusion)\"" || true)
  case "$state" in
    "completed success") break ;;
    completed*)
      echo "::error::The $job job ended with '${state#completed }'; there's no image to test."
      exit 1
      ;;
  esac
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::The $job job didn't finish in time (last seen: '${state:-not started}')."
    exit 1
  fi
  sleep 10
done

dir="${RUNNER_TEMP:-/tmp}/app-image"
gh run download "$GITHUB_RUN_ID" --repo "$GITHUB_REPOSITORY" --name app-image --dir "$dir"
docker load -i "$dir/app-image.tar"
