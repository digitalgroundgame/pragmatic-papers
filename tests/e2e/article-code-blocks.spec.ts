import { expect, test } from "@playwright/test"

import { CODE_BLOCKS_SLUG } from "../../scripts/seed-e2e.constants"

// The e2e seed files the code-blocks demo article (src/endpoints/seed/features/
// code-blocks.ts) under CODE_BLOCKS_SLUG: a TypeScript, a JavaScript, and a CSS
// sample, each with its own Copy button (src/blocks/Code/CopyButton.tsx).

const CSS_SAMPLE = ".icon-grid {\n  display: grid;\n  gap: 1rem;\n  color: var(--brand);\n}"

test.describe("article code blocks", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    // The Clipboard API needs both grants; without them writeText rejects and
    // the button (deliberately) stays on "Copy".
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL })
    await page.goto(`/articles/${CODE_BLOCKS_SLUG}`)
  })

  test("every code block has a Copy button", async ({ page }) => {
    const blocks = page.locator("pre")
    await expect(blocks).toHaveCount(3)
    for (const block of await blocks.all()) {
      await expect(block.getByRole("button", { name: "Copy", exact: true })).toBeVisible()
    }
  })

  test("copying shows Copied!, fills the clipboard, then resets", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are granted on Chromium only")

    const block = page.locator("pre").filter({ hasText: ".icon-grid" })
    const button = block.getByRole("button")
    await expect(button).toHaveText("Copy")

    await button.click()

    await expect(button).toHaveText("Copied!")
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CSS_SAMPLE)

    // CopyButton puts the label back after a second.
    await expect(button).toHaveText("Copy", { timeout: 5_000 })
  })
})
