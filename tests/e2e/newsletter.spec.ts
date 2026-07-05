import { expect, test } from "@playwright/test"

import { expectStableScreenshot, Screenshot, waitForStableRender } from "./helpers"

test("newsletter signup renders in footer", async ({ page }, testInfo) => {
  await page.goto("/")

  const heading = page.getByRole("heading", { name: "Get Daily Pragmatic Papers" })
  await heading.scrollIntoViewIfNeeded()
  await expect(heading).toBeVisible()

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")

  // Settle before measuring the bounding box, not just before the
  // screenshot — otherwise the clip region can be computed mid-animation.
  await waitForStableRender(page)

  const footer = await page.locator("footer").boundingBox()
  const shot = new Screenshot(footer).padding(16)

  await expectStableScreenshot(page, "newsletter-footer.png", { clip: shot.clip })
})
