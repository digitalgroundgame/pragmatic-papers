import { expect, test } from "@playwright/test"

import { waitForStableRender } from "./helpers"

test("home page loads @visual", async ({ page }, testInfo) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/The Pragmatic Papers/)
  await expect(page.locator("a[href*='/articles/']").first()).toBeVisible()

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
  await waitForStableRender(page)
  await expect(page).toHaveScreenshot("home-page.png", { fullPage: true })
})
