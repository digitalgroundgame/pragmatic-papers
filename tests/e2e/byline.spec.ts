import { expect, test } from "@playwright/test"

import { Screenshot, waitForStableBox, waitForStableRender } from "./helpers"

// The e2e seed (scripts/seed-e2e.ts) gives this article four authors against a
// three-slot byline, so it renders the collapsed state: two names and a
// remainder, beside two avatars and a "+2". Kept off the homepage grid on
// purpose — see the seed for why — so navigate to it by slug.
const FOUR_AUTHOR_SLUG = "committee-work-notes-from-a-crowded-byline"

test("byline collapses a fourth author into a remainder @visual", async ({ page }, testInfo) => {
  await page.goto(`/articles/${FOUR_AUTHOR_SLUG}`)

  const byline = page.locator('div:has(> [data-slot="avatar-group"])').first()
  await expect(byline).toBeVisible()

  // Functional checks (run on every project, even when screenshots are skipped
  // locally): the faces and the names agree on how many authors were collapsed.
  await expect(byline.locator('[data-slot="avatar"]')).toHaveCount(2)
  await expect(byline.locator('[data-slot="avatar-group-count"]')).toHaveText("+2")
  await expect(byline).toContainText("Teagan Wordsmith, Sienna Scribe & 2 more")
  await expect(byline).not.toContainText("Marcus Ledger")

  // Every author still reachable further down the page, collapsed or not.
  const cards = page.locator('[data-slot="card"]')
  for (const name of ["Teagan Wordsmith", "Sienna Scribe", "Marcus Ledger", "Alexandra Quill"]) {
    await expect(cards.filter({ hasText: name })).toBeVisible()
  }

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
  await waitForStableRender(page)
  const box = await waitForStableBox(byline)
  const shot = new Screenshot(box).padding(16)

  await expect(page).toHaveScreenshot("article-byline-collapsed.png", { clip: shot.clip })
})
