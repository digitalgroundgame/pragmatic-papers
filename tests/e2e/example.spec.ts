import { test, expect } from "@playwright/test"

test("homepage loads and has correct title", async ({ page }) => {
  // Navigation uses the baseURL from playwright.config.ts
  await page.goto("/")

  // Expect title to contain 'Pragmatic Papers'
  // Adjusted regex to be flexible with the full title string
  await expect(page).toHaveTitle(/Pragmatic Papers/)
})

test("logo is visible", async ({ page }) => {
  await page.goto("/")

  // Look for the logo by alt text or accessible name
  const logo = page.getByRole("link", { name: /The Pragmatic Papers/i })
  await expect(logo).toBeVisible()
})
