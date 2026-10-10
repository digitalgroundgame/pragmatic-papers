# E2E tests

Functional Playwright tests: each spec loads a seeded page and asserts what a
reader can see and do on it. Visual changes are reviewed in Storybook (every
story runs with an axe check in CI and is published per PR) and on the PR's
site preview, not here.

They are the slowest tests we have, so they cover only what needs the real
server and a real browser together: following links between pages, code that
loads on first interaction, focus and scrolling, the clipboard, layout, the
drilldown's URL state, and structured data on real pages. A component's own
markup and states belong in its unit test or Storybook story (whose `play`
function runs in Chromium too), and a route handler's headers in its unit test.

## Running them

```sh
pnpm test:e2e                          # chromium
pnpm test:e2e:all                      # chromium, firefox, webkit, mobile and tablet
pnpm test:e2e -- tests/e2e/foo.spec.ts # any Playwright arguments after --
```

`scripts/test-e2e.mjs` starts a throwaway Postgres (see "Test databases" in
`AGENTS.md`), seeds it with `scripts/seed-e2e.ts`, starts a Next.js server on
it (the dev server locally; `E2E_PROD_SERVER=true` builds and runs
`next start`), then runs Playwright against it. The HTML report lands in
`playwright-report/`.

The specs only read the seed: none signs up, saves or deletes anything. Keep it
that way, because CI runs them on two workers in no fixed order. A test that
has to write should create its own record rather than change a seeded one.

Every slug, name and date the specs rely on comes from the seed through
`scripts/seed-e2e.constants.ts`, so nothing depends on your dev database.

## In CI

The "E2E tests" job in `.github/workflows/playwright.yml` runs the suite
inside the pinned `mcr.microsoft.com/playwright` image, against the app image
the PR's preview deploys (`E2E_IMAGE`: its standalone `node server.js`).
`.github/actions/setup-e2e` sets the environment it runs with. The job log
lists each test with its duration. It runs with
`FONTS_REQUIRED=true`, so an expired `GH_FONT_READ` token fails at
`pnpm install` with a named error instead of silently falling back to Inter.

## Writing a test

- Assert behaviour a reader depends on: what renders, where links go, what a
  click opens. Prefer roles and accessible names over CSS selectors.
- Before adding a test, check the component's story and unit test. When a
  check needs the page, add it to a test that already loads that page (with
  `test.step` to name each part) rather than paying for another page load.
- Go to a seeded page by its slug from `scripts/seed-e2e.constants.ts`. Wait
  on a condition (`expect(...)` retries), never on `waitForTimeout`.
- `tests/e2e/helpers.ts` has what several specs share: `trackPageErrors`,
  `expectPinnedDateline`, and, for geometry assertions, `waitForStableRender` and `waitForStableBox`, which
  let fonts, images and animations settle before you measure a box.
- Timezone (`UTC`), locale (`en-US`) and color scheme (`light`) are pinned in
  `playwright.config.ts`.

## Bumping `@playwright/test`

The image ships the browsers for one Playwright release, so the image tag and
`@playwright/test` move together:

1. Bump `@playwright/test` in `package.json` and run `pnpm install` to update
   `pnpm-lock.yaml`.
2. Update the image tag (`mcr.microsoft.com/playwright:v<version>-<codename>`)
   everywhere it's pinned: `.github/workflows/ci.yml` (the Storybook job) and
   `.github/workflows/playwright.yml`. Match the codename (`noble`, `jammy`,
   ...) across them, not just the version.
3. Run `pnpm exec tsx scripts/check-playwright-image-pin.ts` to confirm the
   tag is in sync everywhere before committing.

The pin check also runs in its own **Playwright pin check** workflow
(`.github/workflows/playwright-pin-check.yml`) on pushes to `dev`/`main` that
touch the lockfile or the pinned files. A drift shows up as a failed Actions
run on trunk; it never blocks a PR.
