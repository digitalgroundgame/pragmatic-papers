import { expect, test } from "@playwright/test"

test.describe("ShareButtons", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "visual baseline captured on chromium only",
  )

  test("article hero shows share trigger", async ({ page }) => {
    await page.goto("/articles/rich-text-showcase")
    const share = page.getByRole("button", { name: "Share" })
    await share.waitFor({ state: "visible" })
    await share.scrollIntoViewIfNeeded()
    await expect(page).toHaveScreenshot("article-share-trigger.png", { fullPage: false })
  })

  test("share popover open", async ({ page }) => {
    await page.goto("/articles/rich-text-showcase")
    const share = page.getByRole("button", { name: "Share" })
    await share.waitFor({ state: "visible" })
    await share.scrollIntoViewIfNeeded()
    await share.click()
    await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
    await expect(page).toHaveScreenshot("article-share-popover-open.png", { fullPage: false })
  })

  test("volume hero share popover open", async ({ page }) => {
    await page.goto("/volumes/1")
    const share = page.getByRole("button", { name: "Share" })
    await share.waitFor({ state: "visible" })
    await share.scrollIntoViewIfNeeded()
    await share.click()
    await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
    await expect(page).toHaveScreenshot("volume-share-popover-open.png", { fullPage: false })
  })
})
