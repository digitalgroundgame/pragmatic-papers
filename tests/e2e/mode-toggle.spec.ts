import { expect, test, type Locator, type Page } from "@playwright/test"

// Every placement of the theme toggle loads its menu on first interaction
// (LoadOnInteraction), and the mobile sheets that hold two of them load the
// same way. The ModeToggle stories cover one toggle's load-on-click and
// load-on-focus; these check each placement on the real page, where the first
// click has to both load the menu and open it.
async function expectToggleOpensMenu(page: Page, scope: Locator) {
  const toggle = scope.getByRole("button", { name: "Toggle theme" })
  await toggle.scrollIntoViewIfNeeded()
  await expect(toggle).toBeVisible()
  await toggle.click()
  // Visible only: a menu closed a moment ago may still be animating out.
  const menu = page.locator('[data-slot="dropdown-menu-content"]').filter({ visible: true })
  await expect(menu).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
}

test("ModeToggle — the header and footer toggles open the theme menu", async ({ page }) => {
  await page.goto("/")
  await test.step("header", () => expectToggleOpensMenu(page, page.locator("header")))
  await test.step("footer", () => expectToggleOpensMenu(page, page.locator("footer")))
})

test.describe("ModeToggle — mobile (iPhone SE)", () => {
  test.use({ viewport: { width: 375, height: 667 } })

  async function openSheet(page: Page, trigger: string) {
    await page.goto("/")
    await page.getByRole("button", { name: trigger }).click()
    const sheet = page.locator('[data-slot="sheet-content"]')
    await expect(sheet).toBeVisible()
    return sheet
  }

  test("settings sheet toggle opens the theme menu", async ({ page }) => {
    await expectToggleOpensMenu(page, await openSheet(page, "User and Settings"))
  })

  test("menu sheet toggle opens the theme menu", async ({ page }) => {
    await expectToggleOpensMenu(page, await openSheet(page, "Menu"))
  })
})
