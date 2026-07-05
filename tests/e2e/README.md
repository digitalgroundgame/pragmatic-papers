# E2E & visual regression tests

Playwright tests live here. Some tests also take screenshots and compare them
against committed baselines in `__screenshots__/`.

## How visual baselines work

- **Baselines are generated on Linux chromium, production Next.js server** —
  either by CI, or locally via `pnpm test:e2e:update-snapshots` (see below).
  **Never generate or commit them from a bare local machine** (plain
  `pnpm test:e2e` with `E2E_SNAPSHOTS=1`) — font rendering and antialiasing
  differ per OS/host, which is exactly the drift that used to make these tests
  flaky. The Dockerized script exists precisely so you don't need to do that.
- **Local runs skip screenshot comparison** (`ignoreSnapshots` in
  `playwright.config.ts`), so `pnpm test:e2e` locally only runs functional
  assertions. Set `E2E_SNAPSHOTS=1` to opt in on the host OS (expect diffs on
  non-Linux) — useful for a quick sanity check, not for generating baselines.
- **A new test with no baseline yet** gets one automatically: the E2E job runs
  with `--update-snapshots=missing`, so a genuinely new screenshot has nothing
  to regress against and CI commits it straight to your branch — no manual
  step needed.
- **A mismatch against an existing baseline** fails the run and posts a
  "Visual regressions detected" PR comment with the actual/diff/expected
  images. This is never auto-committed — accepting it is a deliberate action
  (see below).
- **Concurrent runs on the same branch are unlikely to race each other's
  baseline push.** Both this workflow and "Update snapshot baselines" share
  a `concurrency` group keyed by branch, so pushing a new commit cancels any
  older run still in flight on that branch. Cancellation isn't instant, so
  this shrinks the race window rather than eliminating it — but it rules out
  the practical case of two full runs finishing close together.

## Adding a new screenshot test

Write the test, guarding the screenshot on chromium and stabilizing the
render:

```ts
test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
await waitForStableRender(page)
await expect(page).toHaveScreenshot("my-feature.png", { clip: shot.clip })
```

Push, and either let CI auto-generate the baseline (nothing else to do — a
"Snapshot updates in this PR" comment shows what was added), or generate it
locally first with `pnpm test:e2e:update-snapshots -- --update-snapshots=missing`
(see below) and commit it yourself to skip that round-trip.

## Generating/updating baselines locally (Docker)

`pnpm test:e2e:update-snapshots` runs the suite inside the same
`mcr.microsoft.com/playwright:v1.60.0-noble` image CI uses (pinned to the
exact `@playwright/test` version resolved in `pnpm-lock.yaml`), so the
rendered baselines have the same fonts/antialiasing as CI instead of your
host OS's. Requires Docker with a running daemon (Docker Desktop on
Mac/Windows works — the setup is a plain compose file, no host networking).
Export `GH_FONT_READ` first: CI renders with the private
`@digitalgroundgame/fonts` package installed, so baselines generated with the
fallback font won't match.

```sh
# Update baselines that actually mismatch the current render (mirrors the
# "Update snapshot baselines" CI workflow):
pnpm test:e2e:update-snapshots

# Fill in baselines for brand-new screenshot tests:
pnpm test:e2e:update-snapshots -- --update-snapshots=missing

# Narrow to specific files/projects like any Playwright invocation:
pnpm test:e2e:update-snapshots -- --update-snapshots=changed tests/e2e/foo.spec.ts
```

See `docker-compose.e2e.yml` and `scripts/test-e2e-docker.sh` for what it
does under the hood (Postgres and the Playwright image run as sibling compose
services; inside the Playwright container it installs deps, migrates/seeds,
builds and runs a production Next.js server, then runs Playwright). Review
the resulting PNG diffs before committing, same as you would review any other
change.

Keep the image tag in `docker-compose.e2e.yml` and `.github/workflows/*.yml`
in sync with the `@playwright/test` version in `pnpm-lock.yaml` when
upgrading — a mismatched image runs a different Chromium build than what's
actually installed, defeating the parity this exists for. Bumping
`@playwright/test` and re-pinning the image tag together is a deliberate
chore, not something to gate every feature branch on, so
`node scripts/check-playwright-image-pin.mjs` runs in its own
**Playwright pin check** workflow (`.github/workflows/playwright-pin-check.yml`)
rather than as part of "Static checks" — it fires on pushes to `dev`/`main`
that touch the lockfile or the pinned files, plus a weekly schedule, and
just shows up as a failed Actions run if drift lands on trunk. It never
blocks a PR.

## Accepting an intentional visual change

When a PR run shows "Visual regressions detected" and the diff is expected
(e.g. you redesigned a component), either run
`pnpm test:e2e:update-snapshots` locally and push the result, or run the
**Update snapshot baselines** workflow on that branch to update just the
baselines that actually differ:

```sh
gh workflow run update-snapshots.yml --ref <your-branch>
```

(or Actions → Update snapshot baselines → Run workflow, if you'd rather use the
browser). No inputs needed. It runs with `--update-snapshots=changed`, so a
baseline is only rewritten when the current render actually mismatches it —
unrelated screenshots aren't touched just because the suite ran again. (A full
`--update-snapshots=all` regen re-renders and rewrites _every_ baseline, and the
freshly-rendered pixels differ slightly from the committed ones due to
anti-aliasing / font-hinting jitter — within the `maxDiffPixelRatio` tolerance,
but enough to produce a few noise bytes of diff on each screenshot.)

On a PR, you can trigger the same thing by adding the **`needs screenshots`**
label — no CLI or Actions tab needed. The label is removed automatically once
the run finishes, so re-adding it later triggers another regeneration.

## Keeping screenshots stable

- Use `waitForStableRender(page)` (fonts + paint settle) before every
  screenshot.
- Prefer clipped component screenshots (`Screenshot` helper) over `fullPage`.
- Mask or avoid regions with dynamic content (dates, random ordering, media).
- Timezone (`UTC`), locale (`en-US`), and color scheme (`light`) are pinned in
  `playwright.config.ts`.
