import { expect, test } from "@playwright/test"

// The e2e seed (scripts/seed-e2e.ts) places a full-width Merch carousel
// ("Support The Papers") on the home page: six products, one with a "Sold Out"
// badge, autoplay off. The links' targets, rel and campaign tags are covered by
// the block's unit test (src/blocks/Merch/__tests__/Component.test.tsx); this
// checks that the seeded products reach the page, that the store link comes
// from the deployment's MERCH_SITE_URL, and that the carousel, measuring a real
// 1280px viewport, finds products off-screen and shows its arrows.
test("the home page's merch carousel shows the seeded products and its arrows", async ({
  page,
}) => {
  await page.goto("/")

  const section = page.locator('section[aria-label="Support The Papers"]')
  await section.scrollIntoViewIfNeeded()
  await expect(section).toBeVisible()

  await expect(section.getByRole("link", { name: "Shop all" })).toHaveAttribute(
    "href",
    /^https:\/\/digitalgroundgame\.org\/merch\b/,
  )
  await expect(section.locator('a[href*="/merch/"]')).toHaveCount(6)
  await expect(section.getByText("Sold Out")).toBeVisible()

  // Six products don't fit four-up, so both scroll arrows exist.
  await expect(section.getByRole("button", { name: "Previous slide" })).toBeVisible()
  await expect(section.getByRole("button", { name: "Next slide" })).toBeVisible()
})
