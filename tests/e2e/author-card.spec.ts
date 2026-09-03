import { expect, test } from "@playwright/test"

import { waitForStableBox, waitForStableRender } from "./helpers"

// The e2e seed (scripts/seed-e2e.ts) gives "Teagan Wordsmith" a full spread of
// social links (X, YouTube, Twitch, Instagram, Discord, GitHub), so the author
// card on the listing page exercises every branded icon variant.
test("author card renders social media links @visual", async ({ page }, testInfo) => {
  await page.goto("/authors")

  // The authors view can render the same card in responsive layouts, with only
  // one copy visible at the active viewport. Scope the visual assertion to the
  // rendered card so Playwright strict mode does not fail on hidden duplicates.
  const card = page
    .locator('[data-slot="card"]:visible')
    .filter({ hasText: "Teagan Wordsmith" })
  await expect(card).toBeVisible()

  // Functional check (runs on every project, even when screenshots are skipped
  // locally): all six seeded social links render as external links.
  const socialLinks = card.getByRole("navigation", { name: "Author Links" }).getByRole("link")
  await expect(socialLinks).toHaveCount(6)
  for (const url of [
    "https://x.com/e2ewriter",
    "https://youtube.com/@e2ewriter",
    "https://twitch.tv/e2ewriter",
    "https://instagram.com/e2ewriter",
    "https://discord.gg/e2ewriter",
    "https://github.com/e2ewriter",
  ]) {
    await expect(card.locator(`a[href="${url}"][target="_blank"]`)).toBeVisible()
  }

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")

  await waitForStableRender(page)
  await waitForStableBox(card)

  // Capture the element rather than a clip over the page. The seed now has
  // several authors, so this card sorts wherever its name falls and can sit
  // below the fold — a page clip is intersected with the viewport, which
  // silently truncated this shot to a 37px sliver. An element shot scrolls to
  // the card and captures exactly it, so neither the list's length nor its
  // ordering can reach this baseline.
  await expect(card).toHaveScreenshot("author-card-social-links.png")
})
