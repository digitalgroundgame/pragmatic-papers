import { expect, test } from "@playwright/test"

test("home page loads", async ({ page, browserName }) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/The Pragmatic Papers/)
  await expect(page.locator("a[href*='/articles/']").first()).toBeVisible()

  test.skip(browserName !== "chromium", "visual baseline captured on chromium only")
  await expect(page).toHaveScreenshot("home-page.png", { fullPage: true })
})
