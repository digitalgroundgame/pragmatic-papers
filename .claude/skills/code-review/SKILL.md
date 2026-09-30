---
name: code-review
description: Review the current diff for operational/infra/security consequences and stale assumptions that automated CI (lint, type-check, tests) cannot catch. Pass --comment <owner>/<repo>/pull/<number> to post a summary plus inline findings to the PR, or --pending <owner>/<repo>/pull/<number> to leave them as an unsubmitted review for you to edit and submit.
---

# Code Review

You are reviewing a pull request for **consequences**, not for style or
correctness-in-isolation. CI already enforces lint (`pnpm lint:ci`,
`--max-warnings 0`), Prettier, `pnpm check-types`, and the test suite. **Do
not re-flag anything CI already catches** — no formatting nits, no missing
semicolons, no "this could be more idiomatic TypeScript." If a finding would
also be caught by ESLint or `tsc`, omit it.

Your job is to find what a diff-only, pattern-matching review misses:
issues that only become visible once you trace _where a change is actually
enforced or consumed at runtime_, in _this specific_ hosting setup
(self-hosted via Coolify, Cloudflare as the proxy in front, Postgres via
Drizzle, Payload CMS 3, Next.js 15).

## Step 1 — Identify blast-radius surfaces in the diff

Read the full diff (`gh pr diff <pr>`) and flag every changed line that
touches any of the following categories. A PR can touch zero, one, or many:

- **HTTP headers / `next.config.ts` `headers()`** — caching directives,
  security headers (CSP, HSTS, X-Frame-Options, etc.), redirects
- **Environment variables** — new/renamed/removed vars; check
  `.env.example`, `dockerfiles/.env.example`, `dockerfiles/README.md` for
  whether every environment (local, CI, staging, preview, production)
  actually has it defined, and what happens when it's absent
- **Payload collection `access` functions** (`src/access/*`) — any change to
  who can read/create/update/delete
- **Payload hooks** (`beforeChange`, `afterChange`, `beforeRead`,
  `afterRead`, `beforeDelete`, revalidation hooks) — side effects, cache
  invalidation correctness, ordering
- **Drizzle migrations** (`src/migrations/*`) — backward compatibility,
  whether it's safe to run against a live production database with
  existing rows, column drops/renames that could break in-flight requests
  during a rolling deploy
- **Caching primitives** — `unstable_cache` tags/keys, `React.cache`,
  `revalidateTag`/`revalidatePath` calls, `draftMode()` handling — does the
  change risk serving stale or incorrectly-scoped (cross-tenant,
  cross-draft-state) cached data?
- **Auth/session/cookie logic** — `payload-token`, `__prerender_bypass`,
  Turnstile verification, anything in `src/access/`
- **Dockerfiles / `dockerfiles/*`, `docker-compose.yml`, Coolify-specific env
  vars** (`COOLIFY_FQDN`, `BUILD_ENV`, `COPY_SOURCE_DATABASE`,
  `FORCE_DATABASE_COPY`) — build-time vs runtime behavior, what happens on
  the very first deploy of this change vs. subsequent ones
- **Sentry config** (`next.config.ts` Sentry block, `sentry.*.config.ts`) —
  source map upload, PII scrubbing, sampling rate changes
- **S3/Supabase storage config** — bucket/region/credential handling,
  local-storage fallback (`USE_LOCAL_STORAGE`)
- **Cloudflare-specific assumptions** — Turnstile secret/site keys, proxy
  behavior, anything that assumes a CDN/edge layer that may or may not
  actually be in front of the request in every environment

If the diff touches none of these categories, say so explicitly and move on
to Step 4 — don't manufacture risk where there isn't any.

## Step 2 — Trace each flagged surface to where it's actually enforced

For every surface flagged in Step 1, **do not assert it is safe or unsafe
from reading the diff alone.** Use Read/Grep/Bash to verify:

- If a header or cookie name is referenced, grep for every other place in
  the codebase that reads/sets/depends on it, to find inconsistencies.
- If an env var is added or changed, grep `.env.example`,
  `dockerfiles/README.md`, and any `*.Dockerfile` for whether it's
  documented and supplied in every environment.
- If a Payload access function or hook changes, find every collection that
  uses it and reason about the effective before/after permission matrix.
- If a migration changes a column/table, check whether any
  currently-deployed code (not just code in this diff) still reads/writes
  that column in the old shape — rolling deploys mean old and new code can
  run simultaneously against the same database for a window.
- If a comment or doc string makes a factual claim about infrastructure
  (e.g. "X is Vercel-specific", "Y only happens in production"), verify the
  claim against current reality. **This repo migrated off Vercel to
  self-hosted Coolify + Cloudflare** — stale Vercel-era assumptions in
  comments are a known recurring issue. Flag a wrong/outdated claim even
  though it's "just a comment" — it actively misleads the next person who
  touches that code.

**Show your verification work in the output.** Every safety/risk claim must
be backed by a concrete "Verified `<claim>` by reading `<file>`" or
"Verified `<claim>` by grepping `<pattern>` in `<path>`" statement. Never
write "this looks fine" or "no concerns" without citing what you checked.
If something can't be verified from the repo (e.g. actual live Cloudflare
DNS/proxy config, which isn't in version control), say so explicitly and
flag it as a manual check for the human reviewer — don't assume it's fine.

## Step 3 — Reason about multi-environment effects

This repo has at least four meaningfully different runtime contexts; a
change safe in one can be actively harmful in another:

- **Local dev** (`pnpm dev`, Docker Compose Postgres, port 8000)
- **CI** (GitHub Actions runners, ephemeral Postgres service containers,
  `USE_LOCAL_STORAGE=true`)
- **Preview deployments** (Coolify, per-PR subdomain via `COOLIFY_FQDN`,
  e.g. `pr-330.pragmaticpapers.com`, possibly using a database copied from
  staging)
- **Staging** and **Production** (Coolify, `BUILD_ENV=staging` /
  `production`, production using S3 storage, staging/preview using local
  volume storage)

For any flagged surface, explicitly ask: _does this behave differently, or
break, in one of these four contexts but not the others?_ Pay particular
attention to:

- Effects that only manifest after a **caching layer has already cached the
  old behavior** (e.g. a long-lived security header like HSTS being cached
  by browsers — the danger isn't the next deploy, it's the deploy _after_
  that, once clients have the policy cached). Call out rollout-sequencing
  risk, not just point-in-time correctness.
- Effects that depend on **subdomain/wildcard behavior** — does a per-PR
  preview subdomain inherit, or fail to inherit, a policy set for the
  primary domain?
- Effects that assume a **specific reverse proxy's default behavior** —
  verify the actual claim against current docs/behavior rather than
  assuming defaults from a previous hosting setup still hold.

## Step 4 — Write findings

Produce:

1. A short top-level summary (2-6 sentences): what categories of risk this
   PR touches (per Step 1), and the overall verdict.
2. For each genuine finding: severity (`blocker` / `should-fix` /
   `worth-noting`), the specific file/line, the consequence, and the
   "Verified ... by ..." trail from Step 2.
3. If nothing of substance was found, say so plainly and briefly explain
   what you checked — don't pad the review with invented nitpicks to look
   thorough, and don't repeat anything CI already enforces.

## Posting results (`--comment` mode)

If invoked with `--comment <owner>/<repo>/pull/<number>`, post findings to
that PR:

- Post the top-level summary with `gh pr comment <owner>/<repo>/pull/<number> --body "<summary>"`.
- For findings tied to a specific file/line, use
  `mcp__github_inline_comment__create_inline_comment` so the comment is
  anchored to the code.
- Never request changes or approve (`gh pr review --request-changes` /
  `--approve`) — this skill only comments. Its verdict gates merges only
  through the marker below.
- End the summary with a line asking a reader to reply `/reviewed` once
  they have read the review, then this marker as the very last line. `<sha>`
  is `--head <sha>` when given (CI passes the commit it checked out), else
  the PR's head: `gh pr view <number> --repo <owner>/<repo> --json headRefOid -q .headRefOid`.

  ```md
  <!-- claude-review sha=<sha> verdict=<pass|blocker> -->
  ```

  `verdict=blocker` if any finding is a `blocker`, otherwise `verdict=pass`.
  The "Claude review" job fails on a blocker or a missing marker, and
  `/reviewed` only counts after a summary is on the PR (see
  `.github/workflows/claude-review.yml` and `review-ack.yml`). A summary
  posted from a local run counts too, when whoever ran it has write access,
  so a simple PR needs no CI review. Never post `/reviewed` yourself; it
  stands for a person having read the review.

- If posting fails (e.g. permissions), print the full review to stdout so
  it's still visible in the Action run logs.

## Leaving a pending review (`--pending` mode)

If invoked with `--pending <owner>/<repo>/pull/<number>`, leave the whole
review as one **pending** review: visible only to the account `gh` is
logged in as, until they open **Finish your review** on the PR, edit or
delete comments, and submit it themselves. Local use only; CI uses
`--comment`.

1. Get the head commit: `gh pr view <number> --repo <owner>/<repo> --json headRefOid -q .headRefOid`.
2. Write the request to a temp file (`mktemp`) and send it with
   `gh api -X POST repos/<owner>/<repo>/pulls/<number>/reviews --input <file>`:

   ```json
   {
     "commit_id": "<headRefOid>",
     "body": "<top-level summary>",
     "comments": [
       { "path": "src/x.ts", "line": 42, "side": "RIGHT", "body": "..." },
       {
         "path": "src/y.ts",
         "start_line": 10,
         "line": 12,
         "side": "RIGHT",
         "start_side": "RIGHT",
         "body": "..."
       }
     ]
   }
   ```

   **Never include `event`.** Leaving it out is what keeps the review
   pending; any value submits it. `line` is the line number in the new
   file and must fall inside a diff hunk.

   When a finding's fix is exact and confined to the commented lines, put
   it in that comment's `body` as a suggestion block, which GitHub renders
   with a **Commit suggestion** button (`--comment` mode gets this from
   the inline-comment tool's own description):

   ````md
   Explanation of the finding.

   ```suggestion
   the replacement line(s), indentation included
   ```
   ````

   The block replaces the whole range (`line`, or `start_line` through
   `line`), so it must contain every line of it as it should read
   afterwards. Only for fixes you'd commit as written; if the fix spans
   files, needs a decision, or you're unsure of it, describe it in prose.

3. If GitHub rejects the request:
   - **A comment's line isn't part of the diff:** move that finding into
     `body` with its file and line, and resend.
   - **"one pending review per pull request":** the user already has one
     open on this PR. Stop and ask them to submit or discard it; don't
     delete it yourself.
4. Tell the user it's waiting under **Files changed → Finish your review**.
   If `gh api user -q .login` matches the PR author, add that GitHub will
   only let them submit it as **Comment**: nobody can approve or request
   changes on their own PR.

If invoked without `--comment` or `--pending`, just print the findings —
don't attempt to post anything (this is the local/interactive path, e.g.
`/code-review` during development).
