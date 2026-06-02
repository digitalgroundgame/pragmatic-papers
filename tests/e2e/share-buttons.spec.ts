import { expect, test, type Page } from "@playwright/test"

// Helpers to navigate to the first real article / volume without hardcoding slugs.
// Routes via the homepage (no dedicated listing page exists for /articles or /volumes).
// The CSS attribute selector ensures we only follow article/volume links — not generic
// navigation or 404-page "Go home" links that would lead somewhere without a Share button.
// The 5 s timeout lets tests skip immediately when the CI database is empty.
async function gotoFirstArticle(page: Page) {
  await page.goto("/")
  const link = page.locator('a[href*="/articles/"]').first()
  const href = await link.getAttribute("href", { timeout: 5000 }).catch(() => null)
  if (!href) return null
  await page.goto(href)
  return href
}

async function gotoFirstVolume(page: Page) {
  await page.goto("/")
  const link = page.locator('a[href*="/volumes/"]').first()
  const href = await link.getAttribute("href", { timeout: 5000 }).catch(() => null)
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
  })

  test("URL input is read-only", async ({ page }) => {
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    await page.getByRole("button", { name: "Share" }).click()
    const input = page.getByRole("dialog").getByRole("textbox")
    await expect(input).toBeVisible()
    expect(await input.getAttribute("readonly")).not.toBeNull()
  })

  test("copy button writes URL to clipboard", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions only supported in Chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    await page.getByRole("button", { name: "Share" }).click()
    const expectedUrl = await page.getByRole("dialog").getByRole("textbox").inputValue()

    await page.getByRole("button", { name: "Copy link" }).click()
    await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible()

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
    test(`${label} opens in new tab`, async ({ page, context, isMobile }) => {
      test.skip(isMobile, "New-tab behaviour is tested on desktop browsers only")
      const href = await gotoFirstArticle(page)
      test.skip(!href, "No articles found in the database")

      await page.getByRole("button", { name: "Share" }).click()
      const link = page.getByRole("dialog").getByRole("link", { name: label })

      // Check the share URL before clicking — third-party platforms may redirect
      // unauthenticated users so newPage.url() after load would be a login page.
      expect(await link.getAttribute("href")).toContain(fragment)

      const [newPage] = await Promise.all([context.waitForEvent("page"), link.click()])
      await newPage.close()
    })
  }
})

test.describe("ShareButtons — screenshots", () => {
  test("article share button and popover close-up", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    const share = page.getByRole("button", { name: "Share" })
    await share.waitFor({ state: "visible" })
    await share.scrollIntoViewIfNeeded()
    await share.click()

    const popover = page.locator('[data-slot="popover-content"]')
    await expect(popover).toBeVisible()

    const buttonBox = await share.boundingBox()
    const popoverBox = await popover.boundingBox()
    if (!buttonBox || !popoverBox) throw new Error("Could not get bounding boxes")

    const padding = 16
    const x = Math.max(0, Math.min(buttonBox.x, popoverBox.x) - padding)
    const y = Math.max(0, Math.min(buttonBox.y, popoverBox.y) - padding)
    const right = Math.max(buttonBox.x + buttonBox.width, popoverBox.x + popoverBox.width) + padding
    const bottom =
      Math.max(buttonBox.y + buttonBox.height, popoverBox.y + popoverBox.height) + padding

    await expect(page).toHaveScreenshot("article-share-popover-close-up.png", {
      clip: { x, y, width: right - x, height: bottom - y },
    })
  })

  test("article share trigger", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    const share = page.getByRole("button", { name: "Share" })
    await share.waitFor({ state: "visible" })
    await share.scrollIntoViewIfNeeded()
    await expect(page).toHaveScreenshot("article-share-trigger.png", { fullPage: false })
  })

  test("article share popover open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    const share = page.getByRole("button", { name: "Share" })
    await share.waitFor({ state: "visible" })
    await share.scrollIntoViewIfNeeded()
    await share.click()
    await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
    await expect(page).toHaveScreenshot("article-share-popover-open.png", { fullPage: false })
  })

  test("volume share popover open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    const href = await gotoFirstVolume(page)
    test.skip(!href, "No volumes found in the database")

    const share = page.getByRole("button", { name: "Share" })
    await share.waitFor({ state: "visible" })
    await share.scrollIntoViewIfNeeded()
    await share.click()
    await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
    await expect(page).toHaveScreenshot("volume-share-popover-open.png", { fullPage: false })
  })
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
  })
})
