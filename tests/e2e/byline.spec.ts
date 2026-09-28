import { expect, test } from "@playwright/test"

import { FOUR_AUTHOR_SLUG } from "../../scripts/seed-e2e.constants"
import { waitForStableBox, waitForStableRender } from "./helpers"

// The e2e seed (scripts/seed-e2e.ts) gives this article four authors, so it
// exercises the byline at its widest: every author named, each behind their
// own face. Kept off the homepage grid on purpose — see the seed for why — so
// navigate to it by slug.

const AUTHORS = ["Teagan Wordsmith", "Sienna Scribe", "Marcus Ledger", "Alexandra Quill"]

test("byline names every author beside their avatar @visual", async ({ page }, testInfo) => {
  await page.goto(`/articles/${FOUR_AUTHOR_SLUG}`)

  const byline = page.locator('[data-slot="byline"]')
  await expect(byline).toBeVisible()

  // Functional checks (run on every project, even when screenshots are skipped
  // locally): every author is named, faced, and linked — nothing collapses.
  //
  // Read without the avatars: these seeded authors have no profile image, so
  // each avatar prints their initials, which would otherwise land between the
  // separators and the names ("TWTeagan Wordsmith, SSSienna Scribe").
  const prose = await byline.evaluate((node) => {
    const clone = node.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[data-slot="avatar"]').forEach((avatar) => avatar.remove())
    return clone.textContent?.trim() ?? ""
  })
  expect(prose).toBe("Teagan Wordsmith, Sienna Scribe, Marcus Ledger & Alexandra Quill")

  await expect(byline.locator('[data-slot="avatar"]')).toHaveCount(AUTHORS.length)
  await expect(byline.getByRole("button")).toHaveCount(0)

  for (const name of AUTHORS) {
    await expect(byline.getByRole("link", { name })).toBeVisible()
  }

  // Every author also has a card further down the page.
  const cards = page.locator('[data-slot="card"]')
  for (const name of AUTHORS) {
    await expect(cards.filter({ hasText: name })).toBeVisible()
  }

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
  await waitForStableRender(page)
  await waitForStableBox(byline)

  // Element shot, not a page clip: the byline's position depends on whatever
  // sits above it, and a clip is intersected with the viewport.
  await expect(byline).toHaveScreenshot("article-byline.png")
})
