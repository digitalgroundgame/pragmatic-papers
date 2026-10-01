[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

Pull requests targeting `dev` can get an automated review from Claude Code. It's opt-in per PR — add the **`ready for review`** label and the [Claude Code Review workflow](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/.github/workflows/claude-review.yml) (`claude-review.yml`) runs the repo's [`code-review` skill](https://github.com/digitalgroundgame/pragmatic-papers/blob/dev/.claude/skills/code-review/SKILL.md) against the diff and posts findings directly on the PR.

> [!NOTE]
> This is a comment-only reviewer. It never approves or requests changes (`gh pr review --approve`/`--request-changes`) — it does not gate merging. Human review approval is still required per branch protection (see [Pull Request Checklist](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Pull-Request-Checklist)).

## What It Looks For

CI already enforces lint (`pnpm lint:ci`), Prettier, `pnpm check-types`, and the test suite — Claude's review deliberately does not re-flag anything those already catch (no formatting nits, no "this could be more idiomatic TypeScript"). Instead it looks for **consequences a diff-only, pattern-matching read misses** in this specific hosting setup (self-hosted via Coolify, Cloudflare in front, Postgres via Drizzle, Payload CMS 3, Next.js 15):

- HTTP headers / `next.config.ts` `headers()` — caching, security headers, redirects
- New/renamed/removed environment variables and whether every environment (local, CI, staging, preview, production) actually has them defined
- Payload collection `access` functions and hooks — permission changes, side effects, cache-invalidation ordering
- Drizzle migrations — backward compatibility with a live production database and in-flight requests during a rolling deploy
- Caching primitives (`unstable_cache`, `React.cache`, `revalidateTag`/`revalidatePath`, `draftMode()`) — risk of serving stale or incorrectly-scoped data
- Auth/session/cookie logic, Dockerfiles/Coolify-specific env vars, Sentry config, S3/Supabase storage config, and Cloudflare-specific assumptions

Every risk claim it makes has to be backed by an actual verification step (grepping the codebase, tracing where a value is consumed) — it's instructed not to assert something is safe or unsafe from reading the diff alone, and to flag anything it can't verify (e.g. live Cloudflare config) as a manual check for the human reviewer.

It also reasons across the project's four runtime contexts — local dev, CI, preview deployments, and staging/production — since a change safe in one can break in another (e.g. a long-lived security header cached by browsers, or behavior that assumes Vercel-era defaults from before the migration to self-hosted Coolify).

## Triggering It

1. Open your PR against `dev` as usual (see [Creating Pull Requests](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Pull-Requests)).
2. Add the **`ready for review`** label.
3. The workflow checks out the PR, runs the review, and posts a top-level summary comment plus inline comments anchored to specific files/lines for concrete findings.

If you push more commits and want another pass, remove and re-add the label — the workflow only fires on the label being added (`types: [labeled]`), and runs are cancelled/superseded per-PR via a concurrency group if a newer one starts.

## Running It Locally

The same skill is available interactively during development:

```
/code-review
```

Run without `--comment`, it just prints the findings to your session — nothing gets posted anywhere. This is useful for self-reviewing before opening a PR (see the "Code is self-reviewed by the author before requesting review" item in the [Pull Request Checklist](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Pull-Request-Checklist)).

## Further Reading

- [Creating Pull Requests](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Pull-Requests)
- [Pull Request Checklist](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Pull-Request-Checklist)
- [How to Contribute](https://github.com/digitalgroundgame/pragmatic-papers/wiki/How-to-Contribute)
