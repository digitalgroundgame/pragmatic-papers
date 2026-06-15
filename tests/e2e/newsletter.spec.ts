import { expect, test } from "@playwright/test"

import { Screenshot } from "./helpers"

test("newsletter signup renders in footer", async ({ page }, testInfo) => {
  await page.goto("/")

  const heading = page.getByRole("heading", { name: "Get Daily Pragmatic Papers" })
  await heading.scrollIntoViewIfNeeded()
  await expect(heading).toBeVisible()

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")

  const footer = await page.locator("footer").boundingBox()
  const shot = new Screenshot(footer).padding(16)

  await expect(page).toHaveScreenshot("newsletter-footer.png", { clip: shot.clip })
})
