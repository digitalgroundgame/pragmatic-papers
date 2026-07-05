import { expect, test } from "@playwright/test"

import { expectStableScreenshot, waitForStableRender } from "./helpers"

test("interactive map article renders with pinned tooltip", async ({ page }, testInfo) => {
  await page.goto("/articles/missouri-shifting-margins-119-120-congressional-maps")

  const mapFigure = page.locator("[data-interactive-map-block]")
  await expect(mapFigure).toBeVisible()

  await mapFigure.scrollIntoViewIfNeeded()

  // Click a district to pin a tooltip
  const firstDistrict = page.locator("[data-interactive-map-path]").first()
  await firstDistrict.click()

  const tooltip = page.locator("[data-pinned-tooltip]").first()
  await expect(tooltip).toBeVisible()

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")

  // Settle before measuring the bounding box, not just before the
  // screenshot — otherwise the clip region can be computed mid-animation.
  await waitForStableRender(page)

  const PADDING = 16
  const box = await mapFigure.boundingBox()
  if (!box) throw new Error("map figure bounding box not available")

  await expectStableScreenshot(page, "interactive-map-tooltip.png", {
    clip: {
      x: box.x - PADDING,
      y: box.y - PADDING,
      width: box.width + PADDING * 2,
      height: box.height + PADDING * 2,
    },
  })
})
