import { expect, test } from "@playwright/test"

import { FOOTNOTES_SLUG, SHOWCASE_SLUG } from "../../scripts/seed-e2e.constants"

// The e2e seed files the footnotes demo article (src/endpoints/seed/features/
// footnotes.ts) under FOOTNOTES_SLUG. A footnote marker is a plain in-page link:
// there is no popover to open or dismiss. Its note shows as the marker's
// tooltip (`title`), and following it lands on the note in the Sources list.

const FIRST_NOTE =
  "This is a basic footnote without attribution. It provides additional context or explanation for the preceding text."
const SECOND_NOTE =
  "This footnote includes an attribution link to demonstrate the full capabilities of the footnotes feature."

test.describe("article footnotes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/articles/${FOOTNOTES_SLUG}`)
  })

  test("numbers every marker in order and lists each note under Sources", async ({ page }) => {
    const markers = page.locator("sup")
    for (const index of [1, 2, 3, 4, 5]) {
      await expect(markers.getByRole("link", { name: `[${index}]`, exact: true })).toHaveAttribute(
        "href",
        `#footnote-${index}`,
      )
    }

    const sources = page.getByRole("heading", { level: 2, name: "Sources" })
    await expect(sources).toBeAttached()
    await expect(page.locator("#footnote-1")).toHaveText(FIRST_NOTE)
    await expect(page.locator("#footnote-2")).toHaveText(SECOND_NOTE)
  })

  test("shows the note as the marker's tooltip", async ({ page }) => {
    const marker = page.locator("sup#footnote-ref-1")
    await expect(marker).toHaveAttribute("title", `Footnote 1: ${FIRST_NOTE}`)
    await expect(marker.getByRole("link")).toHaveAttribute("aria-describedby", "footnote-1")
  })

  test("clicking a marker jumps to its note", async ({ page }) => {
    const note = page.locator("#footnote-2")
    await expect(note).not.toBeInViewport()

    await page.getByRole("link", { name: "[2]", exact: true }).click()

    await expect(page).toHaveURL(/#footnote-2$/)
    await expect(note).toBeInViewport()
    await expect(note).toHaveText(SECOND_NOTE)
  })

  test("a note's attribution links to its source", async ({ page }) => {
    const list = page.locator("ol", { has: page.locator("#footnote-1") })

    // An external attribution opens in a new tab.
    const external = list.getByRole("link", { name: "https://en.wikipedia.org/wiki/Footnote" })
    await expect(external).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Footnote")
    await expect(external).toHaveAttribute("target", "_blank")

    // A reference attribution points at another article on the site.
    const reference = list.getByRole("link", { name: new RegExp(`/articles/${SHOWCASE_SLUG}$`) })
    await expect(reference).toHaveAttribute("href", `/articles/${SHOWCASE_SLUG}`)
  })
})
