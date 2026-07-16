import { expect, test } from "@playwright/test"

import { gotoFirstArticle, gotoFirstVolume, waitForStableRender } from "./helpers"

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

  test("copy button label resets after 2 seconds", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions only supported in Chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
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

    // Screenshot the popover element itself rather than a viewport clip over
    // the hero image. The old clip was positioned relative to the viewport,
    // but the popover's scroll position over the hero varied by ~1px between
    // runs (scrollIntoViewIfNeeded lands the trigger a few pixels higher or
    // lower depending on hero-image render height). That shifted every glyph
    // and icon within the clip, producing 7-23% flaky diffs no baseline could
    // pin down. An element screenshot frames on the popover's own box, so it
    // is independent of scroll position and background — deterministic.
    await waitForStableRender(page)
    await expect(popover).toHaveScreenshot("article-share-popover-close-up.png")
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

test.describe("ShareButtons — mobile screenshots (iPhone SE)", () => {
  // iPhone SE (2nd/3rd gen) CSS viewport. Baselines are captured on chromium
  // only (see other screenshot tests in this file) — this overrides the
  // viewport size rather than switching to a WebKit device profile, so the
  // rendering engine (and thus font/anti-aliasing) stays consistent with
  // every other baseline in this suite.
  test.use({ viewport: { width: 375, height: 667 } })

  test("article share trigger", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    const href = await gotoFirstArticle(page)
    test.skip(!href, "No articles found in the database")

    const share = page.getByRole("button", { name: "Share" })
    await share.waitFor({ state: "visible" })
    await share.scrollIntoViewIfNeeded()
    await expect(page).toHaveScreenshot("mobile-article-share-trigger.png", { fullPage: false })
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
    await expect(page).toHaveScreenshot("mobile-article-share-popover-open.png", {
      fullPage: false,
    })
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
    await expect(page).toHaveScreenshot("mobile-volume-share-popover-open.png", {
      fullPage: false,
    })
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
