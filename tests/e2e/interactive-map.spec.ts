import { expect, test } from "@playwright/test"

test("interactive map article pins a tooltip on a clicked district", async ({ page }) => {
  await page.goto("/articles/missouri-shifting-margins-119-120-congressional-maps")

  const mapFigure = page.locator("[data-interactive-map-block]")
  await expect(mapFigure).toBeVisible()

  await mapFigure.scrollIntoViewIfNeeded()

  // Click a district to pin a tooltip
  const firstDistrict = page.locator("[data-interactive-map-path]").first()
  await firstDistrict.click()

  const tooltip = page.locator("[data-pinned-tooltip]").first()
  await expect(tooltip).toBeVisible()
})
