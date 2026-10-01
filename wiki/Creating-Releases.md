[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

Releases normally come from the **release train**, which cuts, promotes and merges releases on a weekly schedule; see [The release train](#the-release-train). The [`pnpm release`](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/scripts/release.ts) script, covered after that, is for cutting a release by hand.

## The release train

The [Release train workflow](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/.github/workflows/release-train.yml) ([`scripts/release-train.ts`](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/scripts/release-train.ts)) cuts a candidate at midnight after Wednesday's dev meeting, so PRs merged that evening make it. It puts the release live at midnight going into Sunday, leaving a day to check production before Monday's articles. Nothing reaches production without a person: the bump PR needs someone to merge it, and the release PR needs someone to approve it.

| When (Pacific)                             | The train                                                                                                                                          | You                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Thursday, midnight**: cut                | Opens "Bump package.json to vX.Y.Z" into `dev`, the next **candidate**                                                                             | Review and merge it **by Friday 8am (9am in summer)**         |
| **Saturday, 8am (9am in summer)**: promote | Opens "Release X.Y.Z" into `main`, from a branch at the candidate's bump commit                                                                    | Check staging, then **approve** the release PR during the day |
| **Sunday, midnight**: merge                | Merges the release PR with a merge commit if a maintainer approved it and its checks are green. That deploys production, and `release.yml` tags it | Check production on Sunday                                    |

GitHub schedules only in UTC, so the times move an hour with daylight saving:

| Run     | UTC            | Winter (PST / EST) | Summer (PDT / EDT) |
| ------- | -------------- | ------------------ | ------------------ |
| Cut     | Thursday 08:00 | 12am / 3am         | 1am / 4am          |
| Promote | Saturday 16:00 | 8am / 11am         | 9am / 12pm         |
| Merge   | Sunday 08:00   | 12am / 3am         | 1am / 4am          |

The midnight runs are at 08:00 UTC so the cut never comes before midnight Pacific.

- **The version** comes from the commit subjects since the last candidate: a `!` makes it major, any `feat` minor, anything else a patch.
- **The release holds everything on `dev` up to the bump commit.** What lands after it waits for next week's candidate.
- **A candidate must spend `SOAK_DAYS` (1) on `dev`** before Saturday's run promotes it, counted from when the bump PR merged. Merged after Friday 8am Pacific (9am in summer), it goes out the weekend after.
- **The midnight merge needs a maintainer's approval on the release PR's current commit,** no outstanding change requests, and GitHub reporting the PR ready to merge (checks green, no conflict). Otherwise it leaves the PR for a person and says why in the run's summary.
- **Approving the bump PR:** the train opens it under the release App's name, so you can approve it like any PR, or reply `LGTM` after a Claude review. A bump PR opened by hand under your own account can't be approved by you; get a Claude review (`/code-review --comment <pr>` or the review label) and reply `LGTM`, or ask another maintainer.
- **To hold a release,** don't approve it, or close its PR. Next week's run offers a newer one.
- **To release earlier or later,** merge the release PR yourself with a **merge commit** (don't squash, don't click "Update branch").
- **To ship a fix without waiting a week,** run the workflow by hand with `soak_days: 0`: once to cut a candidate holding the fix, then, after merging that bump PR, again to open its release PR. A manual run's `step` input picks `cut`, `promote`, `merge` or `all` (cut and promote), and `dry_run` reports the plan without changing anything.
- **After a hotfix** ([Creating Hotfix Releases](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Hotfix-Releases)), a candidate cut before it conflicts with `main`. The train closes its release PR and cuts nothing until the hotfix is back-merged into `dev`.

### Setup

The train opens and merges PRs with a GitHub App's token: the default workflow token can't, because CI doesn't run on PRs it opens and its pushes don't start the deploy and tag workflows.

- **App:** the organisation's GitHub App, with **Contents** and **Pull requests** set to **Read and write**.
- **Repository → Settings → Secrets and variables → Actions:**
  - **Variables** tab: `RELEASE_APP_ID`, the App ID from the App's General page (not the Client ID).
  - **Secrets** tab: `RELEASE_APP_PRIVATE_KEY`, the whole `.pem` from **Generate a private key** on that page (not a client secret).
  - A fine-grained personal token in the secret `RELEASE_TOKEN` also works, but then every bump and release PR is authored by that person, who can't approve them.
- **`main`'s rules** must let the Sunday merge through:
  - **"Require branches to be up to date before merging"** off. The release branch never has `main`'s previous release merge commit, so it's always behind.
  - **"Require linear history"** off, and **merge commits** allowed, since releases merge with a merge commit.
  - If the rules restrict who can push or merge, the App is allowed.

Run the workflow by hand with `dry_run` to check it: the **Generate App token** step runs (not skipped) when the App ID and key are found, and the job summary shows the plan.

## Releasing by hand

Our branch protection rules require a Pull Request (PR) to be reviewed and approved before merging. To release outside the train, open a PR from `dev` into `main`. The `pnpm release` script assists each step.

The flow is:

```
chore/v1.0.0        →  PR → dev         (bumps package.json)
dev                 →  PR → main        (merge commit)
```

The PRs are created by the **local script** (running with your `gh` credentials), not by a GitHub Action — Actions can't open PRs with the default token. The **tag + GitHub release are created automatically** by the [Release workflow](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/.github/workflows/release.yml) when the version bump lands on `main`.

> [!NOTE]
> The script requires the [GitHub CLI (`gh`)](https://cli.github.com). We use [semantic versioning](https://semver.org/) for our tags.

## Step by Step

### Phase 1 — branch off `dev`, bump, PR → `dev`

```bash
pnpm release 1.0.0 --phase 1
```

This checks out `dev`, creates `chore/v1.0.0`, bumps `package.json` to `1.0.0`, pushes, and opens a PR to `dev`. **Get it reviewed and merged into `dev`.**

### Phase 2 — PR `dev` → `main`

```bash
pnpm release 1.0.0 --phase 2
```

This opens a PR from `dev` to `main` and enables auto-merge **as a merge commit** so the branches don't diverge — you don't need to remember "merge, not squash" or avoid the **Update branch** button. When it merges, the Release workflow tags `v1.0.0` and creates the GitHub release automatically.

### Phase 3 — tag and release (optional / manual)

Tagging normally happens automatically via the Release workflow. If you need to tag by hand (e.g. the workflow is disabled), run:

```bash
pnpm release 1.0.0 --phase 3
```

This tags `main` with a signed tag and creates the GitHub release. Signing requires a GPG key registered with your GitHub account.

## Manual fallback

If you can't run the script, the equivalent manual steps are:

```bash
# Phase 1
git checkout dev && git pull origin dev
git checkout -b chore/v1.0.0
git commit -am "Chore: Bump package.json to v1.0.0"
git push origin chore/v1.0.0
gh pr create -f -B dev              # review, then merge into dev

# Phase 2
git checkout dev && git pull origin dev
gh pr create -f -B main            # merge with a REGULAR MERGE (not squash); ignore "Update branch"

# Phase 3 (only if not done automatically)
git checkout main && git pull origin main
git tag v1.0.0 -m "v1.0.0" -s && git push origin v1.0.0
gh release create v1.0.0 --target main -t "v1.0.0"
```

## Further Reading

- [Creating Hotfix Releases](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Hotfix-Releases)
- [Creating Pull Requests](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Pull-Requests)
