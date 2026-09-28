import { expect, test } from "@playwright/test"

import { waitForStableRender } from "./helpers"

test("home page loads @visual", async ({ page }, testInfo) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/The Pragmatic Papers/)
  await expect(page.locator("a[href*='/articles/']").first()).toBeVisible()

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
  await waitForStableRender(page)

  // The grid tiles print `formatTimeAgo(publishedAt)` — a phrase measured
  // against the clock at render time. The seed's publishedAt is pinned, but the
  // distance from it is not: "2 months ago" became "3 months ago" in mid-August
  // and would keep rolling over every month, so the words cannot be baselined.
  // Mask them rather than pinning the date, because the absolute stamp is what
  // article-meta-row.spec.ts asserts and the two want opposite things.
  await expect(page).toHaveScreenshot("home-page.png", {
    fullPage: true,
    mask: [page.locator('[data-slot="time-ago"]')],
  })
})
