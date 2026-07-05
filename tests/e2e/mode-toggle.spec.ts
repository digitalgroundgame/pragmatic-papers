import { expect, test, type Page } from "@playwright/test"

import {
  expectStableScreenshot,
  mergeBoundingBoxes,
  Screenshot,
  waitForStableRender,
} from "./helpers"

test.describe("ModeToggle — desktop screenshots", () => {
  test("header trigger", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const header = page.locator("header")
    const toggle = header.getByRole("button", { name: "Toggle theme" })
    await expect(toggle).toBeVisible()
    await waitForStableRender(page)

    // Clip to the whole header bar, not just the button, so the baseline
    // shows where the toggle sits relative to the rest of the nav.
    const box = await header.boundingBox()
    const shot = new Screenshot(box)
    await expectStableScreenshot(page, "header-mode-toggle-trigger.png", { clip: shot.clip })
  })

  test("header dropdown open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const header = page.locator("header")
    const toggle = header.getByRole("button", { name: "Toggle theme" })
    await expect(toggle).toBeVisible()
    const headerBox = await header.boundingBox()
    if (!headerBox) throw new Error("Could not get header bounding box")

    await toggle.click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await waitForStableRender(page)

    const menuBox = await menu.boundingBox()
    if (!menuBox) throw new Error("Could not get dropdown menu bounding box")

    const shot = new Screenshot(mergeBoundingBoxes(headerBox, menuBox)).padding(16)
    await expectStableScreenshot(page, "header-mode-toggle-dropdown-open.png", {
      clip: shot.clip,
    })
  })

  test("footer trigger", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const footer = page.locator("footer")
    const toggle = footer.getByRole("button", { name: "Toggle theme" })
    await toggle.scrollIntoViewIfNeeded()
    await expect(toggle).toBeVisible()
    await waitForStableRender(page)

    // Clip to the whole footer, not just the button, for the same reason as
    // the header trigger screenshot above.
    const box = await footer.boundingBox()
    const shot = new Screenshot(box)
    await expectStableScreenshot(page, "footer-mode-toggle-trigger.png", { clip: shot.clip })
  })

  test("footer dropdown open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const footer = page.locator("footer")
    const toggle = footer.getByRole("button", { name: "Toggle theme" })
    await toggle.scrollIntoViewIfNeeded()
    await expect(toggle).toBeVisible()
    const footerBox = await footer.boundingBox()
    if (!footerBox) throw new Error("Could not get footer bounding box")

    await toggle.click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await waitForStableRender(page)

    const menuBox = await menu.boundingBox()
    if (!menuBox) throw new Error("Could not get dropdown menu bounding box")

    const shot = new Screenshot(mergeBoundingBoxes(footerBox, menuBox)).padding(16)
    await expectStableScreenshot(page, "footer-mode-toggle-dropdown-open.png", {
      clip: shot.clip,
    })
  })
})

test.describe("ModeToggle — mobile screenshots (iPhone SE)", () => {
  // Matches the viewport convention used by ShareButtons' mobile screenshots:
  // override viewport size rather than switching to a WebKit device profile,
  // so rendering (and thus font/anti-aliasing) stays consistent with every
  // other baseline in this suite.
  test.use({ viewport: { width: 375, height: 667 } })

  async function openMobileSettingsSheet(page: Page) {
    await page.goto("/")
    await page.getByRole("button", { name: "User and Settings" }).click()
    const sheet = page.locator('[data-slot="sheet-content"]')
    await expect(sheet).toBeVisible()
    return sheet
  }

  test("mobile settings sheet trigger", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    const sheet = await openMobileSettingsSheet(page)

    const toggle = sheet.getByRole("button", { name: "Toggle theme" })
    await expect(toggle).toBeVisible()
    await waitForStableRender(page)

    // Clip to the whole sheet panel, not just the button, so the baseline
    // shows the toggle alongside the rest of the settings sheet.
    const box = await sheet.boundingBox()
    const shot = new Screenshot(box)
    await expectStableScreenshot(page, "mobile-settings-mode-toggle-trigger.png", {
      clip: shot.clip,
    })
  })

  test("mobile settings sheet dropdown open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    const sheet = await openMobileSettingsSheet(page)

    const toggle = sheet.getByRole("button", { name: "Toggle theme" })
    await expect(toggle).toBeVisible()
    const sheetBox = await sheet.boundingBox()
    if (!sheetBox) throw new Error("Could not get sheet bounding box")

    await toggle.click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await waitForStableRender(page)

    const menuBox = await menu.boundingBox()
    if (!menuBox) throw new Error("Could not get dropdown menu bounding box")

    const shot = new Screenshot(mergeBoundingBoxes(sheetBox, menuBox)).padding(16)
    await expectStableScreenshot(page, "mobile-settings-mode-toggle-dropdown-open.png", {
      clip: shot.clip,
    })
  })
})
