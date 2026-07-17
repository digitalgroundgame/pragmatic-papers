---
name: github-issues
description: File, triage, or label a GitHub issue in this repo the way we do it — apply an issue TYPE (Bug/Feature/Task) and the right LABELS. Use whenever creating, editing, triaging, or bulk-labeling issues, or when adding/renaming/removing a label. Covers the "Bug is a type not a label" gotcha, the gh-can't-set-type gotcha, and the version-controlled label taxonomy in .github/labels.yml.
---

# Filing & triaging GitHub issues

This repo classifies issues on **two independent axes**. Set both.

1. **Issue type** — `Bug` · `Feature` · `Task`. Org-level metadata, exactly
   one per issue. This is _not_ a label.
2. **Labels** — the taxonomy in `.github/labels.yml` (area, status, kind…).
   Zero or more per issue.

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
  labels=["dggp website"],          # ← best-guess area/kind at filing time
)
```

To set/change the type on an existing issue, call the same tool with
`method="update"`, `issue_number=<n>`, `type="Bug"`.

**`gh` CLI (local dev).** `gh issue create` on **older `gh` (≤ ~2.45)** has
**no `--type` flag** — this is the historical reason the agent skipped it.
Handle it by `gh` version:

- Modern `gh` (≈ 2.63+): `gh issue create --type Bug --label "dggp website" …`
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

**Make a confident best guess — don't punt to triage.** On every new issue,
apply the type and the labels you'd reasonably infer from the title, body,
and the surface it touches (area + kind, and status where it's clear). A
filed issue should land already-classified, not sitting in an inbox waiting
for a human.

There is no `needs-triage` label — we dropped it. If you genuinely can't
determine the area or whether an issue is in scope, apply your best guess
anyway (a maintainer can always correct a label) and name the uncertainty
in the issue body, rather than reaching for a status label to defer the
decision.

| Group           | Labels                                                                    | Apply when…                                          |
| --------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Area**        | `pragmatic papers`, `dggp website`, `discord bot`                         | scoping an issue to a product surface                |
| **Kind**        | `documentation`, `enhancement`, `dependencies`, `javascript`, `reference` | docs-only work / an improvement / a dep bump / etc.  |
| **Discussion**  | `question`, `discussion`                                                  | needs an answer or an open design conversation       |
| **Status**      | `in progress`, `blocked`, `approved`, `stale`                             | tracking workflow state                              |
| **Review** (PR) | `ready for review`, `review comments`                                     | on pull requests moving through review               |
| **Design**      | `waiting on design`, `needs screenshots`                                  | backlogged pending design / needs visual baselines   |
| **Community**   | `good first issue`, `help wanted`                                         | inviting outside contribution                        |
| **Resolution**  | `duplicate`, `invalid`, `wontfix`                                         | when closing (pair with the matching `state_reason`) |

Prefer one Area + one Kind over piling on labels. Don't add `enhancement`
to something already typed `Feature` — the type already says it.

## Closing issues

Always set a reason. MCP: `issue_write(method="update", state="closed",
state_reason="completed" | "not_planned" | "duplicate")` (add
`duplicate_of=<n>` for duplicates). `gh`: `gh issue close <n> --reason …`.
For `duplicate`/`invalid`/`wontfix`, add the matching label too.

## Quick checklist for a new issue

- [ ] Type set (`Bug` / `Feature` / `Task`).
- [ ] Best-guess labels applied — Area if the surface is known, a Kind label
      if it's obviously docs / deps / an enhancement. Guess rather than defer.
- [ ] Every label used exists in `.github/labels.yml`.
