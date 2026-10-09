Closes #

<!--
CI fills in the top of this description, under the Closes line:
1. Links to the showcase articles on the preview, when the PR showcases any
   (add a `Showcase: <slug>` line or the `showcase` label).
2. One line of links: the preview once it deploys (left out when there are
   showcase links, which go to the same site) and the coverage and page speed
   report.
3. Links to the Storybook pages of the components this PR changes.
Leave the hidden markers around those links where they are: CI rewrites what's
between them. Delete the Closes line if the PR closes no issue.
-->

## Context

<!-- Why does this PR exist? What is it fixing? What is it trying to improve? How does it do so? -->

## Screenshots

<!-- For a UI change: before and after, in light and dark mode where it differs. Delete this section otherwise. -->

| Before | After |
| ------ | ----- |
|        |       |

## Test Plan

<!-- How can someone test to ensure that your PR does what you say it does? Tick what you've run. -->

- [ ] `pnpm lint`, `pnpm format` and `pnpm check-types`
- [ ] Unit tests for the code that changed
- [ ] `pnpm test:storybook`, with a story added or updated (blocks and components)
- [ ] Checked on the preview
