import { expect, test } from "@playwright/test"

import { SHOWCASE_SLUG, SHOWCASE_TITLE } from "../../scripts/seed-e2e.constants"

// The TableOfContents stories cover the entries and the collapse button on
// their own. On the article page the button sits in the hero and the list in
// the sidebar, so this checks the two are wired together, and that an entry
// lands on its heading.

test("the article's table of contents links to its headings and collapses from the hero", async ({
  page,
}) => {
  await page.goto(`/articles/${SHOWCASE_SLUG}`)
  await expect(page.getByRole("heading", { level: 1, name: SHOWCASE_TITLE })).toBeVisible()

  const toc = page.getByRole("navigation", { name: "Table of contents" })
  // Found through the nav's slot rather than `toc`: a role locator skips hidden elements, so
  // once the nav collapses (`hidden`) the aside would stop matching and have no box to measure.
  const sidebar = page.locator("aside", { has: page.locator('[data-slot="toc"]') })
  await expect(toc).toBeVisible()

  await test.step("entries jump to their headings", async () => {
    await expect(toc.getByRole("link", { name: "Foundations of Emphasis" })).toBeVisible()
    await expect(toc.getByRole("link", { name: "Structured Lists" })).toBeVisible()
    const conclusion = toc.getByRole("link", { name: "Conclusion" })
    const anchor = await conclusion.getAttribute("href")
    expect(anchor).toMatch(/^#./)
    const heading = page.locator(`[id="${anchor!.slice(1)}"]`)
    await expect(heading).not.toBeInViewport()

    await conclusion.click()

    await expect(heading).toBeInViewport()
  })

  await test.step("the hero button collapses and expands it", async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    const collapse = page.getByRole("button", { name: "Collapse table of contents" })
    await expect(collapse).toHaveAttribute("aria-controls", (await toc.getAttribute("id")) ?? "")
    const openWidth = (await sidebar.boundingBox())?.width ?? 0

    await collapse.click()

    await expect(toc).toBeHidden()
    const expand = page.getByRole("button", { name: "Expand table of contents" })
    await expect(expand).toHaveAttribute("aria-expanded", "false")
    await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeLessThan(openWidth)

    await expand.click()

    await expect(toc).toBeVisible()
  })
})
