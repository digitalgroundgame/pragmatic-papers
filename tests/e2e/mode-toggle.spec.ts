import { expect, test, type Locator, type Page } from "@playwright/test"

// Each toggle loads its menu on first interaction, so these check that the
// first click both loads the menu and opens it.
async function expectToggleOpensMenu(page: Page, scope: Locator) {
  const toggle = scope.getByRole("button", { name: "Toggle theme" })
  await toggle.scrollIntoViewIfNeeded()
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.locator('[data-slot="dropdown-menu-content"]')).toBeVisible()
}

test.describe("ModeToggle — desktop", () => {
  test("header toggle opens the theme menu", async ({ page }) => {
    await page.goto("/")
    await expectToggleOpensMenu(page, page.locator("header"))
  })

  test("footer toggle opens the theme menu", async ({ page }) => {
    await page.goto("/")
    await expectToggleOpensMenu(page, page.locator("footer"))
  })
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
