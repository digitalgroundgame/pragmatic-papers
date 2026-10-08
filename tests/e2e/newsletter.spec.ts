import { expect, test } from "@playwright/test"

test("newsletter signup renders in footer", async ({ page }) => {
  await page.goto("/")

  const heading = page.getByRole("heading", { name: "Get Daily Pragmatic Papers" })
  await heading.scrollIntoViewIfNeeded()
  await expect(heading).toBeVisible()
})
