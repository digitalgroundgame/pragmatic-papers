[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

Some Playwright E2E tests in `tests/e2e/*.spec.ts` take screenshots and compare them against committed baselines in `tests/e2e/__screenshots__/`. Font rendering and antialiasing differ per OS, so baselines are only ever rendered inside the pinned Playwright Docker image (x86_64 Linux Chromium, production Next.js server) — locally with `pnpm test:e2e:update-snapshots`, or by CI. On an x86_64 host the two have been verified pixel-identical, so **generate baselines locally and commit them with your PR**; CI then only has to confirm them. **Never generate or commit baselines from a bare local machine.**

## How Baselines Work

- **Screenshots are only compared when `CI` is set** (`ignoreSnapshots` in `playwright.config.ts`): in GitHub Actions, and inside the Docker script, which sets it. Plain `pnpm test:e2e` on your machine runs functional assertions only.
- **A mismatch against an existing baseline** fails the run and posts a "Visual regressions detected" PR comment with the actual/diff/expected images. This is never auto-committed — accepting it is a deliberate action (see below).
- **A new screenshot test pushed without a baseline** still gets one: CI's `playwright.yml` job runs with `--update-snapshots=missing` and commits it to your branch. That costs an extra run and a bot commit, so prefer generating it locally.

## Generating/Updating Baselines Locally (Docker)

`pnpm test:e2e:update-snapshots` runs the suite inside the same `mcr.microsoft.com/playwright:v<version>-<codename>` image CI uses (pinned to the exact `@playwright/test` version resolved in `pnpm-lock.yaml`), so the rendered baselines have the same fonts/antialiasing as CI instead of your host OS's.

Requires Docker with a running daemon (Docker Desktop works — the setup is a plain compose file, no host networking or socket mounts). Postgres and the Playwright image run as sibling services in `docker-compose.e2e.yml`.

```sh
# Update baselines that actually mismatch the current render:
pnpm test:e2e:update-snapshots

# Fill in baselines for brand-new screenshot tests:
pnpm test:e2e:update-snapshots -- --update-snapshots=missing

# Narrow to specific files/projects like any Playwright invocation:
pnpm test:e2e:update-snapshots -- --update-snapshots=changed tests/e2e/foo.spec.ts

# Rewrite baselines even when the drift is inside the tolerance (see the tip below):
pnpm test:e2e:update-snapshots -- --update-snapshots=all --project=chromium tests/e2e/foo.spec.ts
```

> [!NOTE]
> Export `GH_FONT_READ` first (see [Private Font Setup](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Getting-Started#private-font-setup)). CI renders with the private `@digitalgroundgame/fonts` package installed, so baselines generated with the fallback font won't match.

What the container does:

- **Behaves like CI's E2E job.** It sets `CI` and `E2E_VERIFY_VISUAL`: screenshots are compared, retries/workers match CI, and any baseline it writes is re-rendered twice to prove it's deterministic. With CI's retries, a test that writes a missing baseline fails once and passes on retry, so it reports as flaky rather than failed.
- **Runs as `linux/amd64`**, because CI does and Chromium's arm64 build rasterizes differently. On Apple Silicon that means emulation, so it's slower. Emulated renders are expected to match CI's but haven't been verified yet; if a baseline you generated there fails in CI, use the **Update snapshot baselines** workflow instead and please note it in [#980](https://github.com/digitalgroundgame/pragmatic-papers/issues/980).
- **One run at a time.** Every checkout shares one compose project and one `node_modules` volume, so the script refuses to start while another run is in progress. If one was interrupted and left containers behind: `docker compose -p pragmatic-papers-e2e -f docker-compose.e2e.yml down`.
- **Keeps `node_modules` in a Docker volume stamped with the lockfile** it was installed from. A different lockfile (another branch or worktree) starts it from scratch, relinking from a shared pnpm store rather than re-downloading.

Review the resulting PNG diffs before committing, same as you would review any other change.

## Accepting an Intentional Visual Change

When a change is meant to alter a screenshot (e.g. you redesigned a component), run `pnpm test:e2e:update-snapshots` before pushing, review the PNG diffs, and commit them with the change.

If you can't run Docker or don't have `GH_FONT_READ`, let CI do it at the cost of an extra run and a bot commit:

- Run the **Update snapshot baselines** workflow on your branch (`gh workflow run update-snapshots.yml --ref <your-branch>`, or Actions tab → Update snapshot baselines → Run workflow). It runs with `--update-snapshots=changed`, so only baselines that actually differ get rewritten.
- On a PR, add the **`needs screenshots`** label instead — no CLI needed. The label is removed automatically once the run finishes, so re-adding it later triggers another regeneration.

> [!TIP]
> `changed` compares with the same 1% `maxDiffPixelRatio` the test does, so a small but real change — a date or a word in a full-page shot, a 1px layout shift — stays under the tolerance and is never rewritten. When a change could do that (e.g. the `SEEDED_*` values in `scripts/seed-e2e.constants.ts`), rerun the affected specs locally with `--update-snapshots=all`. Screenshots render byte-identically run to run, so unaffected baselines come out unchanged.

## Bumping the Playwright Version

The Docker image tag, the `@playwright/test` version, and every committed baseline all have to move together — this is the one time baselines legitimately need a full regeneration, since it's the one thing that changes what CI's Chromium actually renders. Treat it as a single chore:

1. Bump `@playwright/test` in `package.json` and run `pnpm install` to update `pnpm-lock.yaml`.
2. Update the image tag (`mcr.microsoft.com/playwright:v<version>-<codename>`) everywhere it's pinned: `docker-compose.e2e.yml`, `.github/workflows/playwright.yml`, and `.github/workflows/update-snapshots.yml`. Match the codename (`noble`/`jammy`/etc.) across all three, not just the version.
3. Regenerate every baseline against the new image: `pnpm test:e2e:update-snapshots -- --update-snapshots=all`.
4. Run `pnpm exec tsx scripts/check-playwright-image-pin.ts` to confirm the tag is in sync everywhere before committing.

A mismatched image runs a different Chromium build than what's actually installed, defeating the whole point of pinning. Since this only ever happens as a deliberate chore rather than something every feature branch should be gated on, the pin check runs in its own **Playwright pin check** workflow instead of as part of "Static checks" — it fires on pushes to `dev`/`main` that touch the lockfile or the pinned files, and just shows up as a failed Actions run if drift lands on trunk (e.g. an automated dependency-bump PR that has no idea the image tag needs to move too). It never blocks a PR.

## Adding a New Screenshot Test

Write the test, guarding the screenshot on Chromium and stabilizing the render:

```ts
test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
await waitForStableRender(page)
await expect(page).toHaveScreenshot("my-feature.png", { clip: shot.clip })
```

`waitForStableRender` (in `tests/e2e/helpers.ts`) waits for web fonts to finish loading, for every `<img>` in the DOM to finish decoding, and for two animation frames to flush in-flight layout/paint — the common sources of flaky screenshot diffs. Prefer clipped component screenshots (the `Screenshot`/`viewportRatioClip` helpers) over `fullPage`, and mask or avoid regions with dynamic content (dates, random ordering, media).

Animate with CSS (ideally behind Tailwind's `motion-safe:`), not SVG SMIL (`<animate>`, `<animateTransform>`): Playwright's `animations: "disabled"` freezes CSS and Web Animations only, so a SMIL animation keeps moving between captures and the screenshot never stabilizes.

Then generate its baseline with `pnpm test:e2e:update-snapshots -- --update-snapshots=missing` and commit it with the test.

## Further Reading

- [Getting Started](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Getting-Started) — local setup, including private font access
- [PR Screenshots](https://github.com/digitalgroundgame/pragmatic-papers/wiki/PR-Screenshots) — auto-attaching E2E screenshots to PR descriptions
- [Pull Request Checklist](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Pull-Request-Checklist)
- [Creating Pull Requests](https://github.com/digitalgroundgame/pragmatic-papers/wiki/Creating-Pull-Requests)
