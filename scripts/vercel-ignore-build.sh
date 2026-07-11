#!/bin/bash
# Vercel "Ignored Build Step" script (wired up via `ignoreCommand` in vercel.json).
# Exit 1 → proceed with the build; exit 0 → skip it.
# Builds only run for the main branch or commits attached to a pull request.

if [[ "$VERCEL_GIT_COMMIT_REF" == "main" ]]; then
  echo "✅ Building: commit is on main"
  exit 1
fi

if [[ -n "$VERCEL_GIT_PULL_REQUEST_ID" ]]; then
  echo "✅ Building: commit belongs to PR #$VERCEL_GIT_PULL_REQUEST_ID"
  exit 1
fi

echo "🛑 Skipping build: ref '$VERCEL_GIT_COMMIT_REF' is not main and has no open PR"
exit 0
