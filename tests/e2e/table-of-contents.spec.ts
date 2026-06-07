import { expect, test } from "@playwright/test"

import { Screenshot } from "./helpers"

test("table of contents renders on rich-text showcase article", async ({ page }, testInfo) => {
  await page.goto("/articles/rich-text-showcase")
  await expect(page).toHaveTitle(/The Written Word/)

  const toc = page.locator('nav[aria-label="Table of contents"]')
  await expect(toc).toBeVisible()

  // Spot-check a few expected heading entries
  await expect(toc.getByRole("link", { name: "Foundations of Emphasis" })).toBeVisible()
  await expect(toc.getByRole("link", { name: "Structured Lists" })).toBeVisible()
  await expect(toc.getByRole("link", { name: "Conclusion" })).toBeVisible()

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
  const box = await toc.boundingBox()
  await expect(page).toHaveScreenshot("table-of-contents-list.png", {
    clip: new Screenshot(box).padding(16).aspectRatio("classic").clip,
  })
})
