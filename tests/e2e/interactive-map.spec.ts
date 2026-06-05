import { expect, test } from "@playwright/test"

test("interactive map article renders with pinned tooltip close-up", async ({ page }, testInfo) => {
  await page.goto("/articles/missouri-shifting-margins-119-120-congressional-maps")

  const mapWidget = page.getByRole("group", { name: "Interactive map widget" })
  await expect(mapWidget).toBeVisible()

  await mapWidget.scrollIntoViewIfNeeded()

  // Click a district to pin a tooltip
  const firstDistrict = page.locator("[data-interactive-map-path]").first()
  await firstDistrict.click()

  const tooltip = page.locator("[data-pinned-tooltip]").first()
  await expect(tooltip).toBeVisible()

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")

  // Clip to the map widget for a close-up that includes the pinned tooltip
  const box = await mapWidget.boundingBox()
  if (!box) throw new Error("map widget bounding box not available")

  await expect(page).toHaveScreenshot("interactive-map-tooltip-closeup.png", {
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  })
})
