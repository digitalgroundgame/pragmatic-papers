import { expect, test, type Page } from "@playwright/test"

import { mergeBoundingBoxes, Screenshot, waitForStableRender } from "./helpers"

test.describe("ModeToggle — desktop screenshots", () => {
  test("header trigger", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const toggle = page.locator("header").getByRole("button", { name: "Toggle theme" })
    await expect(toggle).toBeVisible()
    await waitForStableRender(page)

    const box = await toggle.boundingBox()
    const shot = new Screenshot(box).padding(16)
    await expect(page).toHaveScreenshot("header-mode-toggle-trigger.png", { clip: shot.clip })
  })

  test("header dropdown open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const toggle = page.locator("header").getByRole("button", { name: "Toggle theme" })
    await expect(toggle).toBeVisible()
    const triggerBox = await toggle.boundingBox()
    if (!triggerBox) throw new Error("Could not get header toggle bounding box")

    await toggle.click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await waitForStableRender(page)

    const menuBox = await menu.boundingBox()
    if (!menuBox) throw new Error("Could not get dropdown menu bounding box")

    const shot = new Screenshot(mergeBoundingBoxes(triggerBox, menuBox)).padding(16)
    await expect(page).toHaveScreenshot("header-mode-toggle-dropdown-open.png", {
      clip: shot.clip,
    })
  })

  test("footer trigger", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const toggle = page.locator("footer").getByRole("button", { name: "Toggle theme" })
    await toggle.scrollIntoViewIfNeeded()
    await expect(toggle).toBeVisible()
    await waitForStableRender(page)

    const box = await toggle.boundingBox()
    const shot = new Screenshot(box).padding(16)
    await expect(page).toHaveScreenshot("footer-mode-toggle-trigger.png", { clip: shot.clip })
  })

  test("footer dropdown open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const toggle = page.locator("footer").getByRole("button", { name: "Toggle theme" })
    await toggle.scrollIntoViewIfNeeded()
    await expect(toggle).toBeVisible()
    const triggerBox = await toggle.boundingBox()
    if (!triggerBox) throw new Error("Could not get footer toggle bounding box")

    await toggle.click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await waitForStableRender(page)

    const menuBox = await menu.boundingBox()
    if (!menuBox) throw new Error("Could not get dropdown menu bounding box")

    const shot = new Screenshot(mergeBoundingBoxes(triggerBox, menuBox)).padding(16)
    await expect(page).toHaveScreenshot("footer-mode-toggle-dropdown-open.png", {
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

    const box = await toggle.boundingBox()
    const shot = new Screenshot(box).padding(16)
    await expect(page).toHaveScreenshot("mobile-settings-mode-toggle-trigger.png", {
      clip: shot.clip,
    })
  })

  test("mobile settings sheet dropdown open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    const sheet = await openMobileSettingsSheet(page)

    const toggle = sheet.getByRole("button", { name: "Toggle theme" })
    await expect(toggle).toBeVisible()
    const triggerBox = await toggle.boundingBox()
    if (!triggerBox) throw new Error("Could not get mobile toggle bounding box")

    await toggle.click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await waitForStableRender(page)

    const menuBox = await menu.boundingBox()
    if (!menuBox) throw new Error("Could not get dropdown menu bounding box")

    const shot = new Screenshot(mergeBoundingBoxes(triggerBox, menuBox)).padding(16)
    await expect(page).toHaveScreenshot("mobile-settings-mode-toggle-dropdown-open.png", {
      clip: shot.clip,
    })
  })
})
