[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

A ticket or pull request is only considered **done** when every applicable item
in this checklist is satisfied. If an item doesn't apply to the change you can skip it.

## Checklist

### Code

- [ ] Code is self-reviewed by the author before requesting review
- [ ] Pull request has been reviewed and approved by at least one other developer
- [ ] The **`ready for review`** label has been added so [Claude Code Review](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Claude-Code-Review) can run an automated pass for infra/security consequences
- [ ] No commented-out code or debugging artifacts left in
- [ ] No new linter warnings or errors introduced

### Testing

- [ ] The author has manually tested the change locally
- [ ] The reviewer has manually tested the change on the PR branch or staging
- [ ] Unit tests written for new logic (or existing tests updated if behavior changed)
- [ ] Integration tests written for server components, API routes, and Payload hooks where applicable
- [ ] End-to-end tests written for new user-facing flows where applicable
- [ ] For visually significant UI changes, a screenshot assertion was added/updated in the relevant E2E test and any resulting baseline diffs were reviewed and intentional (see [E2E Visual Regression Testing](https://github.com/digitalgroundgame/pragmatic-papers/wiki/E2E-Visual-Regression-Testing))
- [ ] All existing tests pass in CI
- [ ] No unexplained drop in the coverage report posted to the PR

### Database

- [ ] Any required migrations have been written and tested on the preview deploymen
- [ ] Migrations are safe to run without downtime (non-destructive, backwards compatible where possible)
- [ ] Seed data updated if necessary

### Design & UI

- [ ] Implementation matches the agreed design
- [ ] Tested across relevant breakpoints (mobile, tablet, desktop)
- [ ] No obvious accessibility regressions (keyboard navigation, color contrast, focus states)
- [ ] For UI changes, reviewer checks the auto-attached [PR Screenshots](https://github.com/digitalgroundgame/pragmatic-papers/wiki/PR-Screenshots) (if the E2E test added one) instead of pulling the branch just to look

### Deployment

- [ ] Change has been deployed to staging and verified working
- [ ] No unexpected errors appearing in logs post-deploy

### Documentation

- [ ] Wiki updated if the change affects architecture, workflows, or setup steps
- [ ] Any new environment variables are documented in the relevant environment guide
- [ ] PR description clearly explains what changed and why

## Notes

- **Automated test coverage is still catching up to legacy code.** Manual testing by
  both author and reviewer remains required as a compensating control everywhere
  automated coverage doesn't yet reach. New code should always include tests for the
  logic it adds, even in files that aren't otherwise covered yet.
- Coverage is informational, not a merge gate — a drop doesn't block a PR, but should
  prompt a second look at whether new logic actually got tested.
- The visual regression suite only catches pixel-level UI diffs it has a baseline for.
  It's a complement to manual/design review, not a replacement.
- This checklist applies to features, tasks, and bug fixes. Hotfix releases follow a
  reduced checklist — see [Creating Hotfix Releases](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Hotfix-Releases).
- When in doubt, ask. A slightly slower review is better than a broken production deploy.

## Further Reading

- [Claude Code Review](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Claude-Code-Review) — automated PR review for infra/security consequences
- [E2E Visual Regression Testing](https://github.com/digitalgroundgame/pragmatic-papers/wiki/E2E-Visual-Regression-Testing) — screenshot baselines and how to update them
- [PR Screenshots](https://github.com/digitalgroundgame/pragmatic-papers/wiki/PR-Screenshots) — auto-attaching E2E screenshots to PR descriptions
- [Creating Releases](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Releases)
