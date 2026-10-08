import { expect, test } from "@playwright/test"

test("table of contents renders on rich-text showcase article", async ({ page }) => {
  await page.goto("/articles/rich-text-showcase")
  await expect(page).toHaveTitle(/The Written Word/)

  const toc = page.locator('nav[aria-label="Table of contents"]')
  await expect(toc).toBeVisible()

  // Spot-check a few expected heading entries
  await expect(toc.getByRole("link", { name: "Foundations of Emphasis" })).toBeVisible()
  await expect(toc.getByRole("link", { name: "Structured Lists" })).toBeVisible()
  await expect(toc.getByRole("link", { name: "Conclusion" })).toBeVisible()
})

test("hero button collapses and expands the table of contents", async ({ page }) => {
  await page.goto("/articles/rich-text-showcase")

  const toc = page.locator('nav[aria-label="Table of contents"]')
  const sidebar = page.locator("aside", { has: toc })
  const toggle = page.getByRole("button", { name: "Collapse table of contents" })
  await expect(toc).toBeVisible()
  await expect(toggle).toHaveAttribute("aria-controls", (await toc.getAttribute("id")) ?? "")
  const openWidth = (await sidebar.boundingBox())?.width ?? 0

  await toggle.click()
  await expect(toc).toBeHidden()
  await expect(page.getByRole("button", { name: "Expand table of contents" })).toHaveAttribute(
    "aria-expanded",
    "false",
  )
  await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeLessThan(openWidth)

  await page.getByRole("button", { name: "Expand table of contents" }).click()
  await expect(toc).toBeVisible()
})
