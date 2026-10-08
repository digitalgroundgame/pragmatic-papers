import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { formatHelpDocDate, helpDocs } from ".."

const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

describe("helpDocs", () => {
  it("lists every article in src/docs/, and nothing else", () => {
    const files = readdirSync(docsDir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.slice(0, -".md".length))
    expect(helpDocs.map((doc) => doc.slug).sort()).toEqual(files.sort())
  })

  it("has unique slugs that work in a URL", () => {
    const slugs = helpDocs.map((doc) => doc.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("dates each article as a calendar day, newest first", () => {
    for (const doc of helpDocs) expect(doc.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const dates = helpDocs.map((doc) => doc.publishedAt)
    expect(dates).toEqual([...dates].sort().reverse())
  })
})

describe("formatHelpDocDate", () => {
  it("shows the calendar day whatever the time zone", () => {
    expect(formatHelpDocDate("2026-10-18")).toBe("October 18, 2026")
  })
})
