[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

Our branch protection rules require a Pull Request (PR) to be reviewed and approved before merging.

A hotfix patches production (`main`) directly, then is **back-merged** into `dev` so the branches stay in sync. The [`pnpm hotfix`](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/scripts/hotfix.ts) script assists both PRs, mirroring [`pnpm release`](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Releases).

The flow is:

```
hotfix/v1.0.1        →  PR → main       (branch off main, bumps package.json)
chore/back-merge-v…  →  PR → dev        (branch off main, merge commit into dev)
```

## Why is this necessary?

Hotfixes on `main` let us ship time-sensitive patches to production without waiting for a full `dev` release. Back-merging ensures `dev` has all production changes, keeping the branches' content in sync.

The PRs are created by the **local script** (running with your `gh` credentials), not by a GitHub Action — Actions can't open PRs with the default token (`GitHub Actions is not permitted to create or approve pull requests`). The **tag + GitHub release are created automatically** by the [Release workflow](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/.github/workflows/release.yml) when the version bump lands on `main`, so there is no manual tagging step.

> [!NOTE]
> The script requires the [GitHub CLI (`gh`)](https://cli.github.com). Versions use [semantic versioning](https://semver.org/); a hotfix is a patch bump (e.g. `1.0.0` → `1.0.1`).

## Step by Step

### Phase 1 — branch off `main`, bump, PR → `main`

```bash
pnpm hotfix 1.0.1 --phase 1
```

This checks out `main`, creates `hotfix/v1.0.1`, bumps `package.json` to `1.0.1`, pushes, and opens a PR to `main` (which runs CI). Make your fix on the branch before or after the bump, then **get it reviewed and squash-merge it into `main`.**

When it merges, the Release workflow tags `v1.0.1` and creates the GitHub release automatically.

> [!TIP]
> The script waits and confirms the PR actually merged before continuing — leave it running, or re-run `--phase 1` later.

### Phase 2 — back-merge `main` → `dev`

```bash
pnpm hotfix 1.0.1 --phase 2
```

This branches `chore/back-merge-v1.0.1` off the updated `main`, pushes, opens a PR to `dev`, and enables auto-merge **as a merge commit** so the branches don't diverge. You don't need to remember "merge, not squash" or avoid the **Update branch** button — the script forces the correct merge.

> [!NOTE]
> After the back-merge, `main` will show as "1 behind" `dev`. This is expected — the merge commit exists only on `dev`, but no content has diverged. The branches are in sync.

## Manual fallback

If you can't run the script, the equivalent manual steps are:

```bash
# Phase 1
git checkout main && git pull origin main
git checkout -b hotfix/v1.0.1
# …make the fix and bump package.json to 1.0.1…
git commit -am "Chore: Bump package.json to v1.0.1"
git push origin hotfix/v1.0.1
gh pr create -f -B main            # review, then squash-merge (Release workflow tags it)

# Phase 2
git checkout main && git pull origin main
git checkout -b chore/back-merge-v1.0.1
git push origin chore/back-merge-v1.0.1
gh pr create -f -B dev             # merge with a REGULAR MERGE (not squash); ignore "Update branch"
```

## Further Reading

- [Creating Releases](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Releases)
- [Creating Pull Requests](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Pull-Requests)
