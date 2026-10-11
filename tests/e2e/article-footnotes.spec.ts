import { expect, test } from "@playwright/test"

import { FOOTNOTES_SLUG, SHOWCASE_SLUG } from "../../scripts/seed-e2e.constants"

// The e2e seed files the footnotes demo article (src/endpoints/seed/features/
// footnotes.ts) under FOOTNOTES_SLUG. A footnote marker is a plain in-page link:
// there is no popover to open or dismiss. Its note shows as the marker's
// tooltip (`title`), and following it lands on the note in the Sources list.
// The Footnote and FootnoteList stories cover each piece's markup; this checks
// that the article's save hook numbered and collected them, and the jump.

const FIRST_NOTE =
  "This is a basic footnote without attribution. It provides additional context or explanation for the preceding text."
const SECOND_NOTE =
  "This footnote includes an attribution link to demonstrate the full capabilities of the footnotes feature."

test("footnote markers link to their notes under Sources", async ({ page }) => {
  await page.goto(`/articles/${FOOTNOTES_SLUG}`)

  await test.step("every marker is numbered in order", async () => {
    const markers = page.locator("sup")
    for (const index of [1, 2, 3, 4, 5]) {
      await expect(markers.getByRole("link", { name: `[${index}]`, exact: true })).toHaveAttribute(
        "href",
        `#footnote-${index}`,
      )
    }
    const marker = page.locator("sup#footnote-ref-1")
    await expect(marker).toHaveAttribute("title", `Footnote 1: ${FIRST_NOTE}`)
    await expect(marker.getByRole("link")).toHaveAttribute("aria-describedby", "footnote-1")
  })

  await test.step("each note is listed under Sources with its attribution", async () => {
    await expect(page.getByRole("heading", { level: 2, name: "Sources" })).toBeAttached()
    await expect(page.locator("#footnote-1")).toHaveText(FIRST_NOTE)
    const list = page.locator("ol", { has: page.locator("#footnote-1") })

    // An external attribution opens in a new tab.
    const external = list.getByRole("link", { name: "https://en.wikipedia.org/wiki/Footnote" })
    await expect(external).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Footnote")
    await expect(external).toHaveAttribute("target", "_blank")

    // A reference attribution points at another article on the site.
    const reference = list.getByRole("link", { name: new RegExp(`/articles/${SHOWCASE_SLUG}$`) })
    await expect(reference).toHaveAttribute("href", `/articles/${SHOWCASE_SLUG}`)
  })

  await test.step("clicking a marker jumps to its note", async () => {
    const note = page.locator("#footnote-2")
    await expect(note).not.toBeInViewport()

    await page.getByRole("link", { name: "[2]", exact: true }).click()

    await expect(page).toHaveURL(/#footnote-2$/)
    await expect(note).toBeInViewport()
    await expect(note).toHaveText(SECOND_NOTE)
  })
})
