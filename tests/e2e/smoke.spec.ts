import { expect, test, type Page } from "@playwright/test"

import {
  FOOTNOTES_TITLE,
  SHOWCASE_SLUG,
  SHOWCASE_TITLE,
  TOPIC_NAME,
  TOPIC_SLUG,
  VOLUME_SLUG,
  WRITER_NAME,
  WRITER_SLUG,
  WRITER_SOCIALS,
} from "../../scripts/seed-e2e.constants"
import { trackPageErrors } from "./helpers"

// One check per public route: it answers 200, renders its landmark content,
// and throws no JavaScript error on the way. Every slug comes from the e2e seed
// (scripts/seed-e2e.ts) through its constants, so nothing here depends on a
// shared database.

async function visit(page: Page, path: string): Promise<void> {
  const response = await page.goto(path)
  expect(response?.status(), `${path} should answer 200`).toBe(200)
  await page.waitForLoadState("load")
}

test.describe("public routes", () => {
  let errors: ReturnType<typeof trackPageErrors>

  test.beforeEach(({ page }) => {
    errors = trackPageErrors(page)
  })

  test.afterEach(() => {
    expect(errors(), "console errors and uncaught exceptions").toEqual([])
  })

  test.describe("/", () => {
    test("home page loads", async ({ page }) => {
      await visit(page, "/")
      await expect(page).toHaveTitle(/The Pragmatic Papers/)
      await expect(page.locator("a[href*='/articles/']").first()).toBeVisible()
      await expect(page.getByRole("link", { name: SHOWCASE_TITLE }).first()).toBeVisible()
    })
  })

  test.describe("/contributors", () => {
    test("lists author cards with their social links", async ({ page }) => {
      await visit(page, "/contributors")
      await expect(page.getByRole("heading", { level: 1, name: "Contributors" })).toBeVisible()
      const list = page.getByRole("region", { name: "All contributors" })
      await expect(list.getByRole("link", { name: WRITER_NAME })).toBeVisible()

      // The seed gives the writer one link per platform. Located by the card's own landmark
      // rather than by text: the list streams in behind a Suspense skeleton, and role queries
      // skip the hidden copy React holds before it swaps the resolved cards in.
      const socials = list.getByRole("navigation", { name: `Links for ${WRITER_NAME}` })
      const links = socials.getByRole("link")
      await expect(links).toHaveCount(WRITER_SOCIALS.length)
      for (const { url } of WRITER_SOCIALS) {
        await expect(socials.locator(`a[href="${url}"]`)).toHaveAttribute("target", "_blank")
      }
    })
  })

  test.describe("/contributors/[slug]", () => {
    test("renders the author's name and articles", async ({ page }) => {
      await visit(page, `/contributors/${WRITER_SLUG}`)
      await expect(page.getByRole("heading", { level: 1, name: WRITER_NAME })).toBeVisible()
      const articles = page.getByRole("region", { name: "Articles by this author" })
      // The seed's writer has more articles than fit on one page, so assert
      // the list rather than which ones sort first.
      await expect(articles.getByRole("heading", { level: 2, name: "Articles" })).toBeVisible()
      await expect(
        articles.getByRole("heading", { level: 3 }).getByRole("link").first(),
      ).toHaveAttribute("href", /^\/articles\//)
    })
  })

  test.describe("/articles/[slug]", () => {
    test("renders the title, hero, and byline", async ({ page }) => {
      await visit(page, `/articles/${SHOWCASE_SLUG}`)
      await expect(page.getByRole("heading", { level: 1, name: SHOWCASE_TITLE })).toBeVisible()
      await expect(page.locator("#article-dateline")).toBeVisible()
      const byline = page.locator('[data-slot="byline"]')
      await expect(byline.getByRole("link", { name: WRITER_NAME })).toBeVisible()
    })
  })

  test.describe("/topics", () => {
    test("lists topic links", async ({ page }) => {
      await visit(page, "/topics")
      await expect(page.getByRole("heading", { level: 1, name: "Topics" })).toBeVisible()
      const topics = page.getByRole("region", { name: "All topics" })
      await expect(topics.getByRole("link", { name: TOPIC_NAME })).toHaveAttribute(
        "href",
        `/topics/${TOPIC_SLUG}`,
      )
    })
  })

  test.describe("/topics/[slug]", () => {
    test("renders the topic's name and articles", async ({ page }) => {
      await visit(page, `/topics/${TOPIC_SLUG}`)
      await expect(page.getByRole("heading", { level: 1, name: TOPIC_NAME })).toBeVisible()
      const articles = page.getByRole("region", { name: "Articles for this topic" })
      await expect(articles.getByRole("link", { name: FOOTNOTES_TITLE }).first()).toBeVisible()
    })
  })

  test.describe("/volumes/[slug]", () => {
    test("renders the volume title and article grid", async ({ page }) => {
      await visit(page, `/volumes/${VOLUME_SLUG}`)
      await expect(page.getByRole("heading", { level: 1, name: "Volume I" })).toBeVisible()
      await expect(
        page.getByRole("heading", { level: 2, name: "Articles in this Volume" }),
      ).toBeVisible()
      await expect(page.getByRole("link", { name: new RegExp(SHOWCASE_TITLE) })).toHaveAttribute(
        "href",
        `/articles/${SHOWCASE_SLUG}`,
      )
    })
  })
})
