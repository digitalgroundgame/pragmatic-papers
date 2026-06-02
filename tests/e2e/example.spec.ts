import { expect, test } from "@playwright/test"

test("home page loads", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/The Pragmatic Papers/)
  await expect(page.locator('a[href*="/articles/"]').first()).toBeVisible()
})
