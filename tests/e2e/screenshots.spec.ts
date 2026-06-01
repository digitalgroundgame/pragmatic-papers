import { expect, test } from "@playwright/test"
import fs from "node:fs"

test.skip(
  process.env.CAPTURE_SCREENSHOTS !== "true",
  "Set CAPTURE_SCREENSHOTS=true to enable screenshot capture",
)

test.beforeAll(() => {
  fs.mkdirSync("screenshots", { recursive: true })
})

test.use({ viewport: { width: 1280, height: 800 } })

test("article listing page", async ({ page }) => {
  await page.goto("/articles")
  await expect(page.getByRole("main")).toBeVisible()
  await page.screenshot({ path: "screenshots/articles.png" })
})

test("article page", async ({ page }) => {
  await page.goto("/articles")
  const firstLink = page.getByRole("main").getByRole("link").first()
  const href = await firstLink.getAttribute("href")
  test.skip(!href, "No articles in the database")
  await page.goto(href!)
  await expect(page.getByRole("main")).toBeVisible()
  await page.screenshot({ path: "screenshots/article.png" })
})

test("article page — share popover open", async ({ page }) => {
  await page.goto("/articles")
  const firstLink = page.getByRole("main").getByRole("link").first()
  const href = await firstLink.getAttribute("href")
  test.skip(!href, "No articles in the database")
  await page.goto(href!)
  await page.getByRole("button", { name: "Share" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.screenshot({ path: "screenshots/article-share.png" })
})

test("volume listing page", async ({ page }) => {
  await page.goto("/volumes")
  await expect(page.getByRole("main")).toBeVisible()
  await page.screenshot({ path: "screenshots/volumes.png" })
})

test("volume page", async ({ page }) => {
  await page.goto("/volumes")
  const firstLink = page.getByRole("main").getByRole("link").first()
  const href = await firstLink.getAttribute("href")
  test.skip(!href, "No volumes in the database")
  await page.goto(href!)
  await expect(page.getByRole("main")).toBeVisible()
  await page.screenshot({ path: "screenshots/volume.png" })
})
