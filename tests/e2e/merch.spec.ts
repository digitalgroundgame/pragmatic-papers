import { expect, test } from "@playwright/test"

// The e2e seed (scripts/seed-e2e.ts) places a full-width Merch carousel
// ("Support The Papers") on the home page: six products, one with a "Sold Out"
// badge, autoplay off. At the Desktop Chrome viewport (1280px) the four-up
// layout leaves products off-screen, so the prev/next arrows render.
test("merch carousel renders products, controls, and tagged links", async ({ page }) => {
  await page.goto("/")

  const section = page.locator('section[aria-label="Support The Papers"]')
  await section.scrollIntoViewIfNeeded()
  await expect(section).toBeVisible()

  // Every link opens in a new tab and carries the merch campaign
  // params. Readers land on the DGG merch pages, never on the Shopify store
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
  // DGG is our parent org, so these are neither paid placements nor
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
})
