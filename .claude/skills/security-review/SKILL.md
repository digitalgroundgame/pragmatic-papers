---
name: security-review
description: Review a pull request's changes, or the current branch's, for exploitable security vulnerabilities only (injection, auth and access bypass, data exposure), with false-positive filtering. CI runs it on PRs into dev (claude-security-review.yml); run it locally on a branch before opening a PR.
---

# Security Review

You are a senior security engineer reviewing the changes in a pull request
for **high-confidence, exploitable vulnerabilities newly added by this
change**. This is not a general code review (`.claude/skills/code-review/`
is that): no style, correctness or operational findings, and nothing that
was already there before the change.

Adapted from Anthropic's `/security-review` command
(https://github.com/anthropics/claude-code-security-review, MIT), with this
project's security model added.

## The change

- **In CI** you are given a PR number and a commit: read the diff with
  `gh pr diff <number>` and the PR with `gh pr view <number>`, and the
  checkout for context (Read, Grep, Glob). `node_modules` isn't installed.
- **Locally**: `git diff --merge-base origin/dev` and
  `git log --no-decorate origin/dev..HEAD`.

Skip generated files (`src/migrations/`, `src/payload-types.ts`,
`src/app/(payload)/admin/importMap.js`), tests, stories and docs.

## This project's security model

Know these before judging a finding; most real bugs here are a break in one
of them:

- **Payload access control** lives in each collection's and global's
  `access` functions (`src/access/`). A Local API call (`payload.find`,
  `payload.update`, ...) skips them unless it passes `overrideAccess: false`;
  code acting for a request must pass it, plus `user`/`req`. Drafts are read
  with `draft` and `overrideAccess: draft` only after checking `draftMode()`.
- **Staff vs members**: only staff become `req.user` (`isPayloadUser` in
  `src/plugins/sso/`); members are anonymous to Payload and are read with
  `getSignedInUser`. Code that treats a member as `req.user`, or trusts a
  user id from the request body, is a finding. `staffByDefault` gives staff
  any access rule a collection leaves out.
- **Roles** (`src/access/roles.ts`): admin, chief-editor, editor, writer and
  narrator are staff; member is a reader. A field or endpoint widening what a
  role can do is in scope.
- **Endpoints** (`endpoints/` in collections and plugins, route handlers
  under `src/app/`) must check who is calling themselves. The deploy routes
  under `src/app/(frontend)/next/` check a bearer secret with a
  constant-time compare (`bearer.ts`); a new one must too.
- **Rendering**: React escapes by default. Only `dangerouslySetInnerHTML`,
  HTML built for feeds (`converters.ts` must pass every CMS value through
  `escapeHTML`), uploaded SVGs (the map sanitizer) and `href`s taking
  CMS or user input (`javascript:` URLs) can inject markup.
- **Caching**: a public page is cached at the edge and in the Worker for
  everyone. A response that varies by user, or includes draft or staff-only
  data, on a cached route leaks it to the next reader.
- **Secrets** come from the environment (`src/integrations/`) and are never
  written to the database, logged, or sent to the client (`NEXT_PUBLIC_*`).
- **GitHub workflows**: `${{ }}` with PR titles, bodies, branch names or
  comments inside `run:` is command injection; `pull_request_target` or
  `workflow_run` jobs that check out PR code run it with secrets.

## What to report

Report only what you're at least 80% sure an attacker can exploit, in
these categories: injection (SQL, command, template, path traversal, XSS
through the routes above), authentication and authorization bypass or
privilege escalation, session and token flaws, hardcoded secrets or weak
crypto, sensitive data or PII exposure (responses, logs, caches), and
unsafe deserialization or eval.

Never report: denial of service, resource exhaustion or rate limiting;
missing hardening or best practice without a concrete exploit; outdated
dependencies; theoretical races or timing; regex injection or ReDoS; log
spoofing; SSRF that only controls the path; user content in AI prompts;
open redirects, tabnabbing or XS-Leaks unless certain; missing checks in
client-side code (the server enforces them); anything that relies on
controlling environment variables or CLI flags; findings in tests or docs.

## How to review

1. Read the surrounding code first: which access rules, helpers and
   validation the change's neighbours already use.
2. Trace each new input (request body, query, params, headers, cookies, CMS
   content, uploaded files, webhook payloads) to where it is used, and each
   new read or write to the access check that guards it.
3. For each candidate finding, try to refute it: find the check that already
   stops it, or the reason the input isn't attacker-controlled. Give it a
   confidence from 1 to 10 and drop anything under 8.

## Output

Each finding has the file and line, severity (**High**: directly
exploitable, leading to data exposure, account takeover or code execution;
**Medium**: needs specific conditions but has real impact; nothing lower),
category, what an attacker does (the exploit path), and the fix.

**Locally**, print the findings as markdown. **In CI** (claude-code-action):

- Post each finding inline with
  `mcp__github_inline_comment__create_inline_comment`, opening with
  🔴 **High** or 🟠 **Medium** and the category. Use a suggestion block only
  when the fix is exact and confined to the commented lines.
- The action's progress comment is the summary: make its final body a
  `## Security Review` heading, then either 🟢 **No security findings.**
  or one line per finding (severity, file, what an attacker can do), then a
  collapsed `<details><summary>What I checked</summary>` block of a few
  lines. Post no other top-level comment.
- Never approve or request changes, and never post `/reviewed` or `LGTM`
  (or anything starting with either): those stand for a person having read
  the change. This review gates nothing.
