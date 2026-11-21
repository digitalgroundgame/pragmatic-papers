import { expect, test } from "@playwright/test"

import { CODE_BLOCKS_SLUG } from "../../scripts/seed-e2e.constants"

// A code block's lines don't wrap: they scroll inside the block. The article's column has to
// stay the screen's width for that, or a long line widens the whole page on a phone.

test("an article with code blocks fits a phone's screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(`/articles/${CODE_BLOCKS_SLUG}`)
  await expect(page.locator("pre").first()).toBeVisible()

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
})
