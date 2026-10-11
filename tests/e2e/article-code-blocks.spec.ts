import { expect, test } from "@playwright/test"

import { CODE_BLOCKS_SLUG } from "../../scripts/seed-e2e.constants"

// The e2e seed files the code-blocks demo article (src/endpoints/seed/features/
// code-blocks.ts) under CODE_BLOCKS_SLUG: a TypeScript, a JavaScript, and a CSS
// sample, each with its own Copy button (src/blocks/Code/CopyButton.tsx). The
// Code story covers the button against a mocked clipboard; this one loads the
// lazily-split block on a real page and reads the real clipboard back.

const CSS_SAMPLE = ".icon-grid {\n  display: grid;\n  gap: 1rem;\n  color: var(--brand);\n}"

test("each code block copies its own source to the clipboard", async ({
  page,
  context,
  baseURL,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "clipboard permissions are granted on Chromium only")
  // The Clipboard API needs both grants; without them writeText rejects and
  // the button (deliberately) stays on "Copy".
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL })
  await page.goto(`/articles/${CODE_BLOCKS_SLUG}`)

  const blocks = page.locator("pre")
  await expect(blocks).toHaveCount(3)
  for (const block of await blocks.all()) {
    await expect(block.getByRole("button", { name: "Copy", exact: true })).toBeVisible()
  }

  const button = page.locator("pre").filter({ hasText: ".icon-grid" }).getByRole("button")
  await button.click()

  await expect(button).toHaveText("Copied!")
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CSS_SAMPLE)

  // CopyButton puts the label back after a second.
  await expect(button).toHaveText("Copy", { timeout: 5_000 })
})
