import { describe, expect, it } from "vitest"

import { formatDocFile, formatImageLine, imagesIn, parseDocFile, parseImageLine } from "../docFile"

const source = `---
title: Find a photo: on Unsplash
navTitle: Unsplash photos
summary: "Search Unsplash. # Not a comment"
publishedAt: 2026-10-18
revisedAt: 2026-10-20
heroImage: unsplash-photos-hero.webp
heroAlt: The search
audience: [writer, editor]
showTableOfContents: false
---

Some **text**.

![A drawer \\] with a bracket](unsplash-photos-drawer.webp)
`

describe("parseDocFile", () => {
  it("reads the front matter and the body", () => {
    expect(parseDocFile(source, "a.md")).toEqual({
      meta: {
        title: "Find a photo: on Unsplash",
        navTitle: "Unsplash photos",
        summary: "Search Unsplash. # Not a comment",
        publishedAt: "2026-10-18",
        revisedAt: "2026-10-20",
        heroImage: "unsplash-photos-hero.webp",
        heroAlt: "The search",
        audience: ["writer", "editor"],
        showTableOfContents: false,
      },
      body: "Some **text**.\n\n![A drawer \\] with a bracket](unsplash-photos-drawer.webp)",
    })
  })

  it("writes it back the same, quoting only what needs it", () => {
    const formatted = formatDocFile(parseDocFile(source, "a.md"))
    expect(formatted).toContain('title: "Find a photo: on Unsplash"')
    expect(formatted).toContain("navTitle: Unsplash photos\n")
    expect(parseDocFile(formatted, "a.md")).toEqual(parseDocFile(source, "a.md"))
  })

  it("reads a doc with no hero image", () => {
    const bare = source
      .replace("heroImage: unsplash-photos-hero.webp\n", "")
      .replace("heroAlt: The search\n", "")
    const { meta } = parseDocFile(bare, "a.md")
    expect(meta.heroImage).toBeUndefined()
    expect(formatDocFile({ meta, body: "Hi." })).not.toContain("hero")
  })

  it("reads a doc's tour", () => {
    const withTour = source.replace("---\n\n", "tour: articles\n---\n\n")
    const { meta } = parseDocFile(withTour, "a.md")
    expect(meta.tour).toBe("articles")
    expect(formatDocFile({ meta, body: "Hi." })).toContain("tour: articles\n")
  })

  it("reads the note on what a change is about", () => {
    const withNote = source.replace("---\n\n", "changeNote: Hide moved to the Ticker tab.\n---\n\n")
    const { meta } = parseDocFile(withNote, "a.md")
    expect(meta.changeNote).toBe("Hide moved to the Ticker tab.")
    expect(formatDocFile({ meta, body: "Hi." })).toContain(
      "changeNote: Hide moved to the Ticker tab.\n",
    )
  })

  it.each([
    ["no front matter", "Just text", /no front matter/],
    [
      "an unknown key",
      source.replace("navTitle", "navTitel"),
      /unknown front matter key "navTitel"/,
    ],
    ["a missing key", source.replace("summary:", "sumary:"), /unknown front matter key/],
    [
      "a hero image with no alt text",
      source.replace("heroAlt: The search\n", ""),
      /needs "heroAlt"/,
    ],
    [
      "a date that isn't a day",
      source.replace("2026-10-18", "18 Oct"),
      /"publishedAt" should be a day/,
    ],
    ["a role that doesn't exist", source.replace("writer,", "wizard,"), /list of roles/],
    [
      "a table of contents that isn't on or off",
      source.replace(": false", ": no"),
      /true or false/,
    ],
    [
      "a tour that isn't a key",
      source.replace("---\n\n", "tour: [articles]\n---\n\n"),
      /tour's key/,
    ],
    [
      "a change note that isn't a sentence",
      source.replace("---\n\n", "changeNote: true\n---\n\n"),
      /"changeNote" should be a sentence/,
    ],
  ])("refuses %s", (_, text, message) => {
    expect(() => parseDocFile(text, "a.md")).toThrow(message)
  })
})

describe("image lines", () => {
  it("finds pictures on lines of their own, not inline ones", () => {
    expect(imagesIn("![One](a.png)\ntext ![Two](b.png)\n![Three \\] x](c.png)")).toEqual([
      { alt: "One", file: "a.png" },
      { alt: "Three ] x", file: "c.png" },
    ])
  })

  it("writes what it reads", () => {
    const image = { alt: "A [bracketed] alt", file: "a.png" }
    expect(parseImageLine(formatImageLine(image))).toEqual(image)
  })
})
