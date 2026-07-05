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

    // Clip to the header actions + toggle cluster, not the whole header bar
    // (the full header is already covered by other baselines) or just the
    // button (too tight to tell where it sits relative to its neighbors).
    const donate = header.getByRole("link", { name: "Donate" })
    const joinUs = header.getByRole("link", { name: "Join Us" })
    const [donateBox, joinUsBox, toggleBox] = await Promise.all([
      donate.boundingBox(),
      joinUs.boundingBox(),
      toggle.boundingBox(),
    ])
    if (!donateBox || !joinUsBox || !toggleBox)
      throw new Error("Could not get cluster bounding boxes")

    const shot = new Screenshot(mergeBoundingBoxes(donateBox, joinUsBox, toggleBox)).padding(16)
    await expectStableScreenshot(page, "header-mode-toggle-trigger.png", { clip: shot.clip })
  })

  test("header dropdown open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const header = page.locator("header")
    const toggle = header.getByRole("button", { name: "Toggle theme" })
    await expect(toggle).toBeVisible()

    const donate = header.getByRole("link", { name: "Donate" })
    const joinUs = header.getByRole("link", { name: "Join Us" })
    const [donateBox, joinUsBox, toggleBox] = await Promise.all([
      donate.boundingBox(),
      joinUs.boundingBox(),
      toggle.boundingBox(),
    ])
    if (!donateBox || !joinUsBox || !toggleBox)
      throw new Error("Could not get cluster bounding boxes")

    await toggle.click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await waitForStableRender(page)

    const menuBox = await menu.boundingBox()
    if (!menuBox) throw new Error("Could not get dropdown menu bounding box")

    const shot = new Screenshot(
      mergeBoundingBoxes(donateBox, joinUsBox, toggleBox, menuBox),
    ).padding(16)
    await expectStableScreenshot(page, "header-mode-toggle-dropdown-open.png", {
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

    // Clip to the social links + toggle cluster, not the whole footer (the
    // full footer is already covered by other baselines) or just the button.
    const socials = page.getByRole("navigation", { name: "Footer Social Links" })
    const [socialsBox, toggleBox] = await Promise.all([socials.boundingBox(), toggle.boundingBox()])
    if (!socialsBox || !toggleBox) throw new Error("Could not get cluster bounding boxes")

    const shot = new Screenshot(mergeBoundingBoxes(socialsBox, toggleBox)).padding(16)
    await expectStableScreenshot(page, "footer-mode-toggle-trigger.png", { clip: shot.clip })
  })

  test("footer dropdown open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline captured on chromium only")
    await page.goto("/")

    const toggle = page.locator("footer").getByRole("button", { name: "Toggle theme" })
    await toggle.scrollIntoViewIfNeeded()
    await expect(toggle).toBeVisible()

    const socials = page.getByRole("navigation", { name: "Footer Social Links" })
    const [socialsBox, toggleBox] = await Promise.all([socials.boundingBox(), toggle.boundingBox()])
    if (!socialsBox || !toggleBox) throw new Error("Could not get cluster bounding boxes")

    await toggle.click()
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    await waitForStableRender(page)

    const menuBox = await menu.boundingBox()
    if (!menuBox) throw new Error("Could not get dropdown menu bounding box")

    const shot = new Screenshot(mergeBoundingBoxes(socialsBox, toggleBox, menuBox)).padding(16)
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
