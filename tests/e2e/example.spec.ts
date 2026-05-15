import { test, expect } from "@playwright/test"

test("home page loads", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/Home/)
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible()
})
