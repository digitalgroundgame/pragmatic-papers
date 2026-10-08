import { expect, test } from "@playwright/test"

// The e2e seed (scripts/seed-e2e.ts) gives "Teagan Wordsmith" a full spread of
// social links (X, YouTube, Twitch, Instagram, Discord, GitHub), so the author
// card on the listing page exercises every branded icon variant.
test("author card renders social media links", async ({ page }) => {
  await page.goto("/authors")

  // Visible only: the list streams in behind a Suspense skeleton, and for a
  // moment React holds the resolved cards in a hidden node before it swaps
  // them in, so the page can briefly carry two copies of this card.
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Teagan Wordsmith", visible: true })
  await expect(card).toBeVisible()

  // All six seeded social links render as external links.
  const socialLinks = card
    .getByRole("navigation", { name: "Links for Teagan Wordsmith" })
    .getByRole("link")
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
})
