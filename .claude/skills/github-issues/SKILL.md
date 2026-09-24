---
name: github-issues
description: File, triage, or label a GitHub issue in this repo the way we do it — apply an issue TYPE (Bug/Feature/Task), the right LABELS, and the Project board fields (Status/Priority/Size/Estimate). Use whenever creating, editing, triaging, prioritizing, sizing, or bulk-labeling issues, moving an issue on the board, or adding/renaming/removing a label. Covers the "Bug is a type not a label" gotcha, the gh-can't-set-type gotcha, the version-controlled label taxonomy in .github/labels.yml, and a helper that sets board fields by name.
---

# Filing & triaging GitHub issues

This repo classifies issues on **three independent axes**. Set all three.

1. **Issue type** — `Bug` · `Feature` · `Task`. Org-level metadata, exactly
   one per issue. This is _not_ a label.
2. **Labels** — the taxonomy in `.github/labels.yml` (area, status, kind…).
   Zero or more per issue.
3. **Project board fields** — `Priority`, `Size`, `Estimate` and `Status` on
   the org board **"Pragmatic Papers Development"** (project #3). See
   [Project board fields](#project-board-fields).

The single most common mistake: treating `Bug` as a label. **There is no
`bug` label** — `Bug` is an issue _type_. Applying a nonexistent label
silently no-ops, so the issue ends up classified as nothing.

## Issue types

| Type      | Use for                                        |
| --------- | ---------------------------------------------- |
| `Bug`     | An unexpected problem or behavior              |
| `Feature` | A request, idea, or new functionality          |
| `Task`    | A specific, scoped piece of work (the default) |

Pick one on **every** new issue. When unsure between `Task` and `Feature`:
user-facing capability → `Feature`; internal/dev work (refactor, CI, deps,
tests, docs tooling) → `Task`.

### Setting the type

**GitHub MCP tools (web / remote sessions — the easiest path).**
`issue_write` takes the type by _name_ in the same call that creates the
issue:

```
mcp__github__issue_write(
  method="create", owner="digitalgroundgame", repo="pragmatic-papers",
  title="…", body="…",
  type="Bug",                       # ← by name, no node ID needed
  labels=["documentation"],         # ← best-guess kind/status label(s) at filing time
)
```

To set/change the type on an existing issue, call the same tool with
`method="update"`, `issue_number=<n>`, `type="Bug"`.

**`gh` CLI (local dev).** `gh issue create` on **older `gh` (≤ ~2.45)** has
**no `--type` flag** — this is the historical reason the agent skipped it.
Handle it by `gh` version:

- Modern `gh` (≈ 2.63+): `gh issue create --type Bug --label documentation …`
- Older `gh`: create first, then set the type with a GraphQL mutation.
  Look the type's node ID up **by name at runtime** (don't paste a stale ID):

  ```bash
  ORG=digitalgroundgame
  TYPE_ID=$(gh api graphql -f query='
    query($org:String!){ organization(login:$org){
      issueTypes(first:20){ nodes { id name } } } }' -f org="$ORG" \
    --jq '.data.organization.issueTypes.nodes[] | select(.name=="Bug") | .id')

  ISSUE_ID=$(gh issue view <number> --json id -q .id)
  gh api graphql -f query='mutation($id:ID!,$type:ID!){
    updateIssue(input:{id:$id, issueTypeId:$type}){ issue { number issueType { name } } } }' \
    -f id="$ISSUE_ID" -f type="$TYPE_ID"
  ```

  Known node IDs at time of writing (convenience only — prefer the lookup
  above, which can't go stale): `Task IT_kwDODO7WPM4BogHl` ·
  `Bug IT_kwDODO7WPM4BogHm` · `Feature IT_kwDODO7WPM4BogHn`.

## Labels

**`.github/labels.yml` is the source of truth.** It is synced to GitHub by
`.github/workflows/labels.yml` on push to `dev`. Two rules follow:

- **Only apply labels that exist in `labels.yml`.** Never invent one — an
  unknown label silently fails to apply. When in doubt, read the file (or
  run `gh label list`).
- **To add / rename / recolor / remove a label, edit `labels.yml` in a PR** —
  do _not_ create it in the GitHub UI. A UI-only label is reverted on the
  next sync, and an ad-hoc label bypasses review. Adding the label to the
  file _is_ how you add it to the repo.

### When to apply which

**Apply your best guess at filing time.** On every new issue, set the type
and any labels you can reasonably infer from the title and body — a Kind
label if it's clearly docs/deps, plus any status that applies. A filed issue
should land already-classified. If you can't tell whether it's valid or in
scope, still make your best guess (a maintainer can correct a label) and note
the uncertainty in the body.

| Group           | Labels                                                                                   | Apply when…                                                                        |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Kind**        | `documentation`, `dependencies`, `testing`, `ci`, `security`, `performance`, `reference` | the nature of the work — docs / deps / tests / CI / security / perf / saved-ref PR |
| **Discussion**  | `question`, `discussion`                                                                 | needs an answer or an open design conversation                                     |
| **Status**      | `in progress`, `blocked`, `stale`                                                        | tracking workflow state                                                            |
| **Review** (PR) | `ready for review`, `review comments`                                                    | on pull requests moving through review                                             |
| **Design**      | `waiting on design`, `needs screenshots`                                                 | backlogged pending design / needs visual baselines                                 |
| **Community**   | `good first issue`, `help wanted`                                                        | inviting outside contribution                                                      |
| **Resolution**  | `duplicate`, `invalid`, `wontfix`                                                        | when closing (pair with the matching `state_reason`)                               |

Keep the label set minimal — a Kind and/or a Status is usually enough. The
issue **type** (`Bug` / `Feature` / `Task`) already says what kind of work it
is, so labels only need to add what the type doesn't.

## Project board fields

Issues live on the org Project **"Pragmatic Papers Development"**
(`https://github.com/orgs/digitalgroundgame/projects/3`). The board's
built-in workflows handle two transitions for you:

- **New issues are added automatically** with `Status: Backlog`. Don't add them
  by hand.
- **Closing an issue moves it to `Done`.** Don't set `Done` yourself.
- **PRs are not tracked on the board.** Only issues. Don't add PRs.

Other workflows (reopen, PR linked, PR merged) are switched on too, but the
Status they set lives in the board's workflow settings and isn't visible
through the API. Don't assume they moved an issue; check its `Status`
(`gh issue view <n> --json projectItems`) before relying on it.

### Fields and how we use them

| Field                     | Values                                                                    | Convention                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Status`                  | `Backlog` · `Ready` · `In progress` · `In review` · `Needs Work` · `Done` | Set `Ready` when an issue is scoped and can be picked up, `In progress` when work starts. `In review` / `Needs Work` exist but aren't used. |
| `Priority`                | `P0` · `P1` · `P2` · `P3`                                                 | Set on every open issue.                                                                                                                    |
| `Size`                    | `XS` · `S` · `M` · `L` · `XL`                                             | Set on every open issue, together with `Estimate`.                                                                                          |
| `Estimate`                | story points (number)                                                     | Follows `Size`: **XS = 0.5 or 1, S = 2, M = 3, L = 5, XL = 8**. Never set without `Size`.                                                   |
| `Start date` / `End date` | date                                                                      | Not used. Leave empty.                                                                                                                      |

Assignees, labels, milestone, parent issue and linked PRs are issue attributes
the board only displays. Set those on the issue (`gh issue edit`), not on the
board.

**At filing time**, after type and labels:

- **`Size` and `Estimate`:** set your best guess, using the mapping above. Say
  in the body if the size is uncertain.
- **`Priority`:** this orders the team's work, so treat your value as a
  proposal. Set `P1`–`P3` when you're confident, **never `P0` unless someone
  asked for it**, and state the priority you chose and why in your reply so a
  human can change it. If you can't judge it, leave it unset and say so.
- **`Status`:** leave it at `Backlog`. Set `Ready` only when asked, and
  `In progress` only when you start working on the issue yourself.

### Setting fields

Use the helper next to this file, from the repo root. One GraphQL query looks
up the project, the issue's board item, and every field and option by name, so
nothing goes stale, and it adds the issue to the board if it's missing:

```bash
pnpm tsx .claude/skills/github-issues/set-project-field.ts 953 Priority P2
pnpm tsx .claude/skills/github-issues/set-project-field.ts 953 Size M
pnpm tsx .claude/skills/github-issues/set-project-field.ts 953 Estimate 3
pnpm tsx .claude/skills/github-issues/set-project-field.ts 953 Status Ready
pnpm tsx .claude/skills/github-issues/set-project-field.ts 953 Priority --clear
```

It checks the edit before touching the board: a misspelled field or option
fails with the list of valid names, `Estimate` must be a number and dates
`YYYY-MM-DD`, and fields the board only mirrors (Labels, Assignees…) are
refused with a pointer to `gh issue edit`. Tests live in
`tests/scripts/set-project-field.test.ts`.

To read an issue's current board values:
`gh issue view <n> --json projectItems` (shows `Status`); the `QUERY` in the
helper is the pattern for reading the other fields.

**Requirements:** a current `gh` (tested with 2.101) and the **`project`** token scope. Without the
scope, `gh project` fails with `missing required scopes [read:project]`. Add
it in a real terminal (the browser device flow needs one; Claude Code's `!`
prefix doesn't provide it):

```bash
gh auth refresh -h github.com -s project
```

In web/remote sessions (where the GitHub proxy blocks GraphQL, so neither `gh
project` nor this helper works), dispatch `.github/workflows/project-fields.yml`
via the GitHub MCP `run_workflow` tool with inputs `issue`, `field` and `value`,
using the same field and option names as above. It runs `gh project item-edit`
on an Actions runner with the repo's project credentials. It has no `--clear`;
omit `field` and `value` to only add the issue to the board.

## Closing issues

Always set a reason. MCP: `issue_write(method="update", state="closed",
state_reason="completed" | "not_planned" | "duplicate")` (add
`duplicate_of=<n>` for duplicates). `gh`: `gh issue close <n> --reason …`.
For `duplicate`/`invalid`/`wontfix`, add the matching label too.

## Quick checklist for a new issue

- [ ] Type set (`Bug` / `Feature` / `Task`).
- [ ] Best-guess labels applied — a Kind label if it's obviously docs / deps,
      plus any status that's clear. Guess rather than defer.
- [ ] Every label used exists in `.github/labels.yml`.
- [ ] `Size` and the matching `Estimate` set on the board (the issue is added
      as `Backlog` automatically).
- [ ] `Priority` set only if you're confident (never `P0` unasked), and the
      value you chose stated in your reply.
