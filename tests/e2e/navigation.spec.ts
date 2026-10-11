import { expect, test } from "@playwright/test"

import {
  FOOTNOTES_TITLE,
  SHOWCASE_SLUG,
  SHOWCASE_TITLE,
  TOPIC_NAME,
  WRITER_NAME,
  WRITER_SLUG,
} from "../../scripts/seed-e2e.constants"

// Click-through journeys across pages, driven the way a reader would: by the
// links' names, never by URL or class. Everything named here comes from the
// e2e seed (scripts/seed-e2e.ts). Where each listing's links point is checked
// by the smoke test; these check that following them, and coming back, works.

test.describe("navigation", () => {
  test("home → article → author profile → back", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("link", { name: SHOWCASE_TITLE }).first().click()

    await expect(page).toHaveURL(`/articles/${SHOWCASE_SLUG}`)
    await expect(page.getByRole("heading", { level: 1, name: SHOWCASE_TITLE })).toBeVisible()

    await page.locator('[data-slot="byline"]').getByRole("link", { name: WRITER_NAME }).click()

    await expect(page).toHaveURL(`/contributors/${WRITER_SLUG}`)
    await expect(page.getByRole("heading", { level: 1, name: WRITER_NAME })).toBeVisible()

    await page.goBack()

    await expect(page).toHaveURL(`/articles/${SHOWCASE_SLUG}`)
    await expect(page.getByRole("heading", { level: 1, name: SHOWCASE_TITLE })).toBeVisible()
  })

  test("authors list pagination", async ({ page }) => {
    await page.goto("/contributors")
    const list = page.getByRole("region", { name: "All contributors" })
    const names = list.getByRole("heading", { level: 3 })
    await expect(names.first()).toBeVisible()
    const firstPage = await names.allTextContents()
    expect(firstPage.length).toBeGreaterThan(0)

    await page.getByRole("link", { name: "Go to next page" }).click()

    await expect(page).toHaveURL(/\/contributors\?p=2$/)
    await expect(
      page.getByRole("navigation", { name: "pagination" }).locator('[aria-current="page"]'),
    ).toHaveText("2")
    await expect(names.first()).toBeVisible()
    const secondPage = await names.allTextContents()
    expect(secondPage.length).toBeGreaterThan(0)
    expect(secondPage.filter((name) => firstPage.includes(name))).toEqual([])
  })

  test("topics list → topic → article", async ({ page }) => {
    await page.goto("/topics")

    await page
      .getByRole("region", { name: "All topics" })
      .getByRole("link", { name: TOPIC_NAME })
      .click()

    await expect(page.getByRole("heading", { level: 1, name: TOPIC_NAME })).toBeVisible()
    const articles = page.getByRole("region", { name: "Articles for this topic" })
    await articles.getByRole("link", { name: FOOTNOTES_TITLE }).first().click()

    await expect(page.getByRole("heading", { level: 1, name: FOOTNOTES_TITLE })).toBeVisible()
  })
})
