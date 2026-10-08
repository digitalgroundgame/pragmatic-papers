import { expect, test } from "@playwright/test"

import { SHOWCASE_SLUG, VOLUME_SLUG } from "../../scripts/seed-e2e.constants"

// What each share link points at, the read-only field and the "Copied!" reset
// are covered by ShareButtons' unit test and its Open story. These check that
// a real page hands the popover its own absolute URL, and that Copy link puts
// it on the real clipboard.

test("an article's share popover copies the article's URL", async ({
  page,
  context,
  baseURL,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "clipboard permissions are granted on Chromium only")
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL })
  await page.goto(`/articles/${SHOWCASE_SLUG}`)

  await page.getByRole("button", { name: "Share" }).click()
  const dialog = page.getByRole("dialog")
  const input = dialog.getByRole("textbox")
  await expect(input).toHaveValue(new RegExp(`^https?://[^/]+/articles/${SHOWCASE_SLUG}$`))
  const url = await input.inputValue()

  await dialog.getByRole("button", { name: "Copy link" }).click()
  await expect(dialog.getByRole("button", { name: "Copied!" })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url)
})

test("a volume's share popover offers the volume's URL", async ({ page }) => {
  await page.goto(`/volumes/${VOLUME_SLUG}`)

  await page.getByRole("button", { name: "Share" }).click()

  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue(
    new RegExp(`^https?://[^/]+/volumes/${VOLUME_SLUG}$`),
  )
})
