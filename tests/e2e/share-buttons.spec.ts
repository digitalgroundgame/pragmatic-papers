import { expect, test, type Page } from "@playwright/test"
import fs from "node:fs"

test.beforeAll(() => {
  fs.mkdirSync("screenshots", { recursive: true })
})

// Helpers to navigate to the first real article / volume without hardcoding slugs.
async function gotoFirstArticle(page: Page) {
  await page.goto("/articles")
  const firstLink = page.getByRole("main").getByRole("link").first()
  const href = await firstLink.getAttribute("href")
  if (!href) return null
  await page.goto(href)
  return href
}

async function gotoFirstVolume(page: Page) {
  await page.goto("/volumes")
  const firstLink = page.getByRole("main").getByRole("link").first()
  const href = await firstLink.getAttribute("href")
  if (!href) return null
  await page.goto(href)
  return href
}

test.describe("ShareButtons — article page", () => {
  test("share button is visible", async ({ page }) => {
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible()
  })

  test("popover opens on click and shows URL input", async ({ page }) => {
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    await page.getByRole("button", { name: "Share" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    const input = dialog.getByRole("textbox")
    await expect(input).toBeVisible()
    const value = await input.inputValue()
    expect(value).toContain("/articles/")
    expect(value).toMatch(/^https?:\/\//)

    await page.screenshot({ path: "screenshots/share-popover-article.png" })
  })

  test("URL input is read-only", async ({ page }) => {
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    await page.getByRole("button", { name: "Share" }).click()
    const input = page.getByRole("dialog").getByRole("textbox")
    await expect(input).toBeVisible()
    expect(await input.getAttribute("readonly")).not.toBeNull()
  })

  test("copy button writes URL to clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    await page.getByRole("button", { name: "Share" }).click()
    const expectedUrl = await page.getByRole("dialog").getByRole("textbox").inputValue()

    await page.getByRole("button", { name: "Copy link" }).click()
    await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible()

    await page.screenshot({ path: "screenshots/share-copied-feedback.png" })

    const clipped = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipped).toBe(expectedUrl)
  })

  test("copy button label resets after 2 seconds", async ({ page }) => {
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    await page.getByRole("button", { name: "Share" }).click()
    await page.getByRole("button", { name: "Copy link" }).click()
    await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible({ timeout: 4000 })
  })

  test("share links have correct hrefs", async ({ page }) => {
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    await page.getByRole("button", { name: "Share" }).click()
    const dialog = page.getByRole("dialog")

    // Share links render as <a target="_blank"> via LinkButton — check href attributes.
    const cases = [
      { label: "Share on X", fragment: "x.com/intent/tweet" },
      { label: "Share on Bluesky", fragment: "bsky.app/intent/compose" },
      { label: "Share on Facebook", fragment: "facebook.com/sharer" },
      { label: "Share on Threads", fragment: "threads.net/intent/post" },
      { label: "Share on Reddit", fragment: "reddit.com/submit" },
      { label: "Share on LinkedIn", fragment: "linkedin.com/shareArticle" },
      { label: "Share via Email", fragment: "mailto:" },
    ]

    for (const { label, fragment } of cases) {
      const link = dialog.getByRole("link", { name: label })
      await expect(link).toBeVisible()
      const linkHref = await link.getAttribute("href")
      expect(linkHref).toContain(fragment)
      expect(await link.getAttribute("target")).toBe("_blank")
    }
  })

  const SOCIAL_LINKS = [
    { label: "Share on X", fragment: "x.com/intent/tweet" },
    { label: "Share on Bluesky", fragment: "bsky.app/intent/compose" },
    { label: "Share on Facebook", fragment: "facebook.com/sharer" },
    { label: "Share on Threads", fragment: "threads.net/intent/post" },
    { label: "Share on Reddit", fragment: "reddit.com/submit" },
    { label: "Share on LinkedIn", fragment: "linkedin.com/shareArticle" },
  ]

  for (const { label, fragment } of SOCIAL_LINKS) {
    test(`${label} opens in new tab`, async ({ page, context }) => {
      const href = await gotoFirstArticle(page)
      test.skip(!href, "No articles found in the database")

      await page.getByRole("button", { name: "Share" }).click()
      const [newPage] = await Promise.all([
        context.waitForEvent("page"),
        page.getByRole("dialog").getByRole("link", { name: label }).click(),
      ])
      expect(newPage.url()).toContain(fragment)
      await newPage.close()
    })
  }
})

test.describe("ShareButtons — volume page", () => {
  test("share button is visible and aligned to the right", async ({ page }) => {
    const href = await gotoFirstVolume(page)
    test.skip(!href, "No volumes found in the database")

    const shareButton = page.getByRole("button", { name: "Share" })
    await expect(shareButton).toBeVisible()

    // The button should be to the right of the date (ml-auto). Verify it sits
    // at least halfway across the article container.
    const box = await shareButton.boundingBox()
    const viewportWidth = page.viewportSize()?.width ?? 1280
    expect(box?.x ?? 0).toBeGreaterThan(viewportWidth / 2)
  })

  test("popover opens and shows a volume URL", async ({ page }) => {
    const href = await gotoFirstVolume(page)
    test.skip(!href, "No volumes found in the database")

    await page.getByRole("button", { name: "Share" }).click()
    const input = page.getByRole("dialog").getByRole("textbox")
    await expect(input).toBeVisible()
    const value = await input.inputValue()
    expect(value).toContain("/volumes/")
    expect(value).toMatch(/^https?:\/\//)

    await page.screenshot({ path: "screenshots/share-popover-volume.png" })
  })
})
