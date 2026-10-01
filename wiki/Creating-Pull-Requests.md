[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

Our branch protection rules require a Pull Request (PR) to be reviewed and approved before merging commits into `dev`.

When picking up a new issue, we create a branch from `dev` and open a PR back into `dev` when the work is complete.

The flow is:

```
feature/my-feature    →  PR → dev
```

## Step by Step

1. Pick up an issue

Assign the issue to yourself on [GitHub Issues](https://github.com/digitalgroundgame/pragmatic-papers/issues) or the [Project Board](https://github.com/orgs/digitalgroundgame/projects/3), and set the status to **In Progress**.

2. Create a new branch from `dev`

Branch names should communicate the work being done.

Common naming conventions:

```
fix/*         - for bug fixes to `dev`, usually correlates with a `PATCH` version bump.
feat/*        - for new features, usually correlates with a `MINOR` version bump.
chore/*       - for updating packages and back-merging from `main`
username/*    - for those who prefer username scoped issues
```

> [!TIP]
> Its easy to search for your own branches if you use username scoped branch names at the downside of losing context such as `feature`, `chore` or `fix`.

```bash
git checkout dev
git pull origin dev
git checkout -b feat/my-feature-branch
```

3. Make your changes

```bash
git add .
git commit -m "feat: my feature message"
git push origin feat/my-feature-branch
```

> [!NOTE]
> We generally follow [Conventional Commits](https://www.conventionalcommits.org/) for our commit messages. This messages will useful to yourself and reviewers seeing as we squash-merge PRs to `dev` so the discrete commit messages will be lost upon squash-merging.

4. Create a pull request from your branch to `dev`

You can use Github.com to create your PR. You will be provided with a PR template to fill out to assist reviewers in testing your changes.

You can also create a PR using GitHub CLI.

```bash
gh pr create -f -B dev
```

Make sure to link the issue in the PR description so it closes automatically on merge.

5. Get it reviewed and approved, then `Squash and Merge` into `dev`.

## Further Reading

- [Creating Releases](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Releases)
