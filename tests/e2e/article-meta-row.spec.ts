import { expect, test } from "@playwright/test"

import { FOUR_AUTHOR_SLUG } from "../../scripts/seed-e2e.constants"
import { gotoFirstArticle, waitForStableBox, waitForStableRender } from "./helpers"

// The hero's meta row puts the dateline and the controls (narration player,
// share button) on one line while they fit, and drops the controls onto their
// own line when they don't. The two states want opposite alignments — hugging
// the right edge when shared, spread to both edges when wrapped — and the flip
// is driven by the actual wrap rather than a breakpoint, so it is only
// observable in a browser. Hence geometry assertions here rather than a class
// assertion in the component's unit snapshot.
//
// The seed gives narration to exactly one article (see scripts/seed-e2e.ts), so
// this is the only page where the row carries both controls.
const NARRATED_ARTICLE = `/articles/${FOUR_AUTHOR_SLUG}`

const row = '[data-slot="article-meta"]'
const controls = '[data-slot="article-meta-controls"]'
const audioPlayer = '[data-slot="audio-player"]'

/** Same line when their vertical centres agree; a wrap moves one a whole row. */
function sharesLineWith(a: { y: number; height: number }, b: { y: number; height: number }) {
  return Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < 2
}

test.describe("article hero meta row — dateline and controls on one line", () => {
  test("controls hug the right edge, player beside the share button @visual", async ({
    page,
  }, testInfo) => {
    await page.goto(NARRATED_ARTICLE)

    const metaRow = page.locator(row)
    const metaControls = page.locator(controls)
    const dateline = page.locator("#article-dateline")
    const share = page.getByRole("button", { name: "Share" })
    const player = page.locator(audioPlayer)

    await expect(dateline).toBeVisible()
    await expect(player).toBeVisible()
    await expect(share).toBeVisible()

    await waitForStableRender(page)
    const rowBox = await waitForStableBox(metaRow)
    const controlsBox = await waitForStableBox(metaControls)
    const datelineBox = await waitForStableBox(dateline)
    const playerBox = await waitForStableBox(player)
    const shareBox = await waitForStableBox(share)

    // Everything is on the one line the wide viewport affords.
    expect(sharesLineWith(datelineBox, controlsBox)).toBe(true)
    expect(sharesLineWith(playerBox, shareBox)).toBe(true)

    // Right-aligned: the share button ends where the row does.
    expect(shareBox.x + shareBox.width).toBeCloseTo(rowBox.x + rowBox.width, 0)

    // Grouped, not spread: the player sits a gap away from the share button
    // rather than being flung to the left edge. gap-3 is 12px; the tolerance
    // leaves room for the button's own padding without admitting a spread,
    // which on this viewport would be several hundred pixels.
    expect(shareBox.x - (playerBox.x + playerBox.width)).toBeLessThan(24)

    // The dateline keeps its place at the start of the row — the lopsided grow
    // factor stretches its box, not its text.
    expect(datelineBox.x).toBeCloseTo(rowBox.x, 0)

    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    // The dateline carries an "Updated <date>" stamp that moves with the day the
    // seed runs, and it would be a large share of a crop this tight. Masking
    // covers the text while keeping its box — which is what drives the wrap —
    // exactly where it is.
    await expect(metaRow).toHaveScreenshot("article-meta-row.png", { mask: [dateline] })
  })
})

test.describe("article hero meta row — controls wrapped onto their own line", () => {
  // Narrow enough that the dateline plus both controls cannot share a line.
  test.use({ viewport: { width: 375, height: 667 } })

  test("wrapped controls spread to both edges @visual", async ({ page }, testInfo) => {
    await page.goto(NARRATED_ARTICLE)

    const metaRow = page.locator(row)
    const metaControls = page.locator(controls)
    const dateline = page.locator("#article-dateline")
    const share = page.getByRole("button", { name: "Share" })
    const player = page.locator(audioPlayer)

    await expect(dateline).toBeVisible()
    await expect(player).toBeVisible()
    await expect(share).toBeVisible()

    await waitForStableRender(page)
    const rowBox = await waitForStableBox(metaRow)
    const controlsBox = await waitForStableBox(metaControls)
    const datelineBox = await waitForStableBox(dateline)
    const playerBox = await waitForStableBox(player)
    const shareBox = await waitForStableBox(share)

    // The premise: the controls really did drop below the dateline.
    expect(sharesLineWith(datelineBox, controlsBox)).toBe(false)
    expect(controlsBox.y).toBeGreaterThanOrEqual(datelineBox.y + datelineBox.height)

    // Alone on the line, the group takes the full row.
    expect(controlsBox.width).toBeCloseTo(rowBox.width, 0)

    // Spread: player against the left edge, share button against the right.
    expect(playerBox.x).toBeCloseTo(rowBox.x, 0)
    expect(shareBox.x + shareBox.width).toBeCloseTo(rowBox.x + rowBox.width, 0)
    expect(shareBox.x - (playerBox.x + playerBox.width)).toBeGreaterThan(24)

    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    // The dateline carries an "Updated <date>" stamp that moves with the day the
    // seed runs, and it would be a large share of a crop this tight. Masking
    // covers the text while keeping its box — which is what drives the wrap —
    // exactly where it is.
    await expect(metaRow).toHaveScreenshot("mobile-article-meta-row.png", { mask: [dateline] })
  })

  test("an article without narration keeps its share button right-aligned", async ({ page }) => {
    // Most articles have no narration, leaving the share button alone in the
    // group. `justify-between` would pin it to the left edge once wrapped; this
    // is the guard that it stays where the wide layout had it.
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")
    await expect(page.locator(audioPlayer)).toHaveCount(0)

    const metaRow = page.locator(row)
    const share = page.getByRole("button", { name: "Share" })
    await expect(share).toBeVisible()

    await waitForStableRender(page)
    const rowBox = await waitForStableBox(metaRow)
    const shareBox = await waitForStableBox(share)

    expect(shareBox.x + shareBox.width).toBeCloseTo(rowBox.x + rowBox.width, 0)
    expect(shareBox.x).toBeGreaterThan(rowBox.x + rowBox.width / 2)
  })
})
