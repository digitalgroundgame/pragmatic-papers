---
name: e2e-visual-tests
description: Author or modify a Playwright visual regression (screenshot) test in tests/e2e. Use whenever adding, changing, or debugging a toHaveScreenshot assertion, a screenshot baseline, or flaky visual-diff failures. Covers the @visual tag, stabilization helpers, baseline generation, and the determinism gate. tests/e2e/README.md is the source of truth — this is the checklist.
---

# Authoring e2e visual regression tests

Screenshot tests in this repo are pinned to a specific rendering environment
and guarded by a determinism gate. They are easy to make flaky. Follow this
checklist; defer details to **`tests/e2e/README.md`** (source of truth) and
the helpers in **`tests/e2e/helpers.ts`**. Do not duplicate README content
into tests — link behaviour to the helpers instead.

## When writing or changing a screenshot test

1. **Tag it `@visual`.** Append `@visual` to the test title of every test that
   calls `toHaveScreenshot` (e.g. `test("share popover open @visual", …)`).
   The **Verify screenshot determinism** CI step only re-renders `@visual`
   tests; an untagged screenshot test escapes the flake gate.

2. **Guard to chromium and stabilize before every shot.**

   ```ts
   test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
   // …drive the UI…
   await waitForStableRender(page) // fonts decode + images decode + 2 rAF
   ```

3. **Prefer element-relative captures.** Screenshot the component
   (`await expect(locator).toHaveScreenshot("name.png")`) or a clip derived
   from its box — not `fullPage`, and never a fixed viewport clip positioned
   over dynamic background (hero image, dates, media, random ordering).

4. **If the clip is positioned relative to an element whose layout can settle
   late** (e.g. a popover below a hero image that resolves its intrinsic
   height a frame or two after decode), call `waitForStableBox(locator)`
   before computing the clip. It polls the bounding box until layout stops
   moving, so the capture is identical every run. Skipping this shifts the
   element ~1px and ghosts every glyph/icon — a 7-23% diff no baseline can pin.

5. **Never fix flakiness by widening `maxDiffPixelRatio`.** A screenshot that
   needs more than ~1-2% tolerance is capturing something nondeterministic.
   Fix the capture (stable layout, element-relative clip, mask dynamic
   regions), don't loosen the budget.

## Generating / updating baselines

- **Generate baselines locally with `pnpm test:e2e:update-snapshots`** and
  commit them with the change. It runs in CI's pinned image as `linux/amd64`
  and its renders are pixel-identical to CI's. Needs Docker + `GH_FONT_READ`.
  - New screenshot: `-- --update-snapshots=missing`.
  - Intentional change: the default (`changed`); for drift inside the 1%
    tolerance, `-- --update-snapshots=all --project=chromium <spec>`.
- **Never generate baselines on a bare host** — font rendering/antialiasing
  differ per OS; plain `pnpm test:e2e` skips screenshots because `CI` isn't
  set there.
- Without Docker, CI can do it at the cost of an extra run and a bot commit:
  push a new test and `playwright.yml` commits its missing baseline, or add
  the **`needs screenshots`** label / run
  `gh workflow run update-snapshots.yml --ref <branch>` for a changed one.
- A deleted baseline is treated as missing and regenerated. Use this when a
  test's capture changes so much that keeping the old PNG would read as a
  regression instead of a fresh baseline.

## Reading failures

- **Every PR suddenly fails visual regression** (esp. the text/icon-dense
  `article-share-popover-close-up`): suspect the render environment before the
  baselines — an expired `GH_FONT_READ` token makes CI render with fallback
  fonts; a changed CI runner image shifts fonts/antialiasing. See the
  troubleshooting note in `tests/e2e/README.md`.
- **The Verify screenshot determinism step fails**: the baseline is flaky
  (only matches its own first render). Make the capture deterministic per the
  checklist above — do not just regenerate the baseline, it will flake again.

## Determinism knobs already in place

`playwright.config.ts` pins timezone (`UTC`), locale (`en-US`), color scheme
(`light`), disables animations, and hides the caret. `waitForStableRender`
settles fonts + image decode + paint. Reuse these; do not reinvent them.
