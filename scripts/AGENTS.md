# CI scripts

## PR description links

CI keeps the top of a PR's description up to date, under any `Closes #N` lines:
the showcase links (`scripts/showcase-pr.ts`), then one line of links, then the
Storybook links (`scripts/storybook-pr.ts`). The line holds the live preview,
and the PR analytics comment ("Coverage"); each job sets its own link with `setPrLink`, and the Preview link is
left out while showcase links point at the same site. Each block sits between
`<!-- name -->` markers, and every job edits the description through
`scripts/pr-description.ts`: `withBlock` places a block, and `editPrBody`
reads the description back after writing and writes again when another job's
edit replaced it (GitHub has no conditional write). A script run under plain
Node imports it as `./pr-description.ts`, and its workflow's sparse checkout
lists it. `.github/pull_request_template.md` lists the blocks above Context,
Screenshots and Test Plan.

## Page speed

The "Page speed" job in `playwright.yml` measures the image the PR deploys two ways,
and each compares it with the last run on `dev` in a dropdown under the coverage report, in the one
PR analytics comment CI keeps on a PR. A dropdown starts open when it flags
something. A new report joins that comment by registering a section in
`PR_REPORT_SECTIONS` (`scripts/pr-report.ts`) and posting it with
`postPrReportSection()`, rather than posting a comment of its own:

- **Bundle size** (`scripts/bundle-size.ts`, the job's first part) reads the image's build manifests and
  adds up the gzipped JavaScript and CSS each public page loads before it's
  interactive (Next 16 no longer prints "First Load JS"). Pages are expected to
  grow over time, so there are no fixed budgets: a route whose JavaScript grew by
  more than 10 kB against dev is flagged in the comment and with a warning on the
  PR's checks. It **only warns**; `pnpm analyze` shows which import brought the
  growth in.
- **Lighthouse** (`scripts/lighthouse.ts`, run even when bundle size fails) runs on a PR when
  the `in review` label is added (six minutes on every push otherwise; the Claude review takes
  the label off when it finishes), and on every push to `dev`. It seeds the E2E database, starts the PR's image and audits each page 5 times, comparing with the results the last
  push to `dev` uploaded. The CPU slowdown is calibrated to the runner's benchmark
  score, and Chrome can't reach any host but localhost. Dev's results come from
  another runner, so a metric is flagged only when every PR run is worse than
  every dev run by a wide margin (`THRESHOLDS`). It **only warns**: the HTML
  reports are in the `lighthouse-results` artifact. A page added to the seed can
  be audited by adding it to `PAGES`.
