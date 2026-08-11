import { expect, test } from "@playwright/test"

import { Screenshot, waitForStableBox, waitForStableRender } from "./helpers"

// The e2e seed (scripts/seed-e2e.ts) places a full-width Merch carousel
// ("Support The Papers") on the home page: six products, one with a "Sold Out"
// badge, autoplay off. At the Desktop Chrome viewport (1280px) the four-up
// layout leaves products off-screen, so the prev/next arrows render.
test("merch carousel renders products, controls, and tagged links @visual", async ({
  page,
}, testInfo) => {
  await page.goto("/")

  const section = page.locator('section[aria-label="Support The Papers"]')
  await section.scrollIntoViewIfNeeded()
  await expect(section).toBeVisible()

  // Functional checks (run on every project, even where screenshots are
  // skipped). Every link opens in a new tab and carries the merch campaign
  // params. Readers land on the DiGG merch pages, never on the Shopify store
  // that only supplies the data.
  const shopAll = section.getByRole("link", { name: "Shop all" })
  await expect(shopAll).toBeVisible()
  const shopAllHref = await shopAll.getAttribute("href")
  expect(shopAllHref).toContain("digitalgroundgame.org/merch")
  expect(shopAllHref).not.toContain("store.digitalgroundgame.org")
  expect(shopAllHref).toContain("utm_source=pragmaticpapers")
  expect(shopAllHref).toContain("utm_medium=merch_block")
  expect(shopAllHref).toContain("utm_content=fullWidth_shop_all")
  expect(await shopAll.getAttribute("target")).toBe("_blank")
  // DiGG is our parent org, so these are neither paid placements nor
  // unendorsed links.
  expect(await shopAll.getAttribute("rel")).toBe("noopener")

  const productLinks = section.locator('a[href*="/merch/"]')
  await expect(productLinks).toHaveCount(6)
  for (const link of await productLinks.all()) {
    expect(await link.getAttribute("target")).toBe("_blank")
    expect(await link.getAttribute("rel")).toBe("noopener")
    expect(await link.getAttribute("href")).toContain("utm_content=fullWidth_product")
    expect(await link.getAttribute("href")).not.toContain("store.digitalgroundgame.org")
  }

  await expect(section.getByText("Sold Out")).toBeVisible()
  await expect(section.getByText("$100.00")).toBeVisible()

  // Six products don't fit four-up, so both scroll arrows exist.
  await expect(section.getByRole("button", { name: "Previous slide" })).toBeVisible()
  await expect(section.getByRole("button", { name: "Next slide" })).toBeVisible()

  test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")

  // The carousel's slides share one horizontal row, so scrolling the section
  // into view above puts even the off-screen ones within Chromium's lazy-load
  // threshold — they fetch on their own and waitForStableRender's decode wait
  // settles without stalling.
  await waitForStableRender(page)
  const box = await waitForStableBox(section)
  const shot = new Screenshot(box).padding(16)

  await expect(page).toHaveScreenshot("merch-carousel-full-width.png", { clip: shot.clip })
})
