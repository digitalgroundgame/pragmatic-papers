// @vitest-environment node
import { describe, expect, it } from "vitest"

import { changedFiles, diffDocSource, newChangeNote, withoutChangeNote } from "../suggest"

const doc = (summary: string, note?: string) =>
  `---\ntitle: Footnotes\nsummary: ${summary}\npublishedAt: 2026-10-09\n${
    note ? `changeNote: ${note}\n` : ""
  }---\n\nOne.\n\nTwo.\n\nThree.\n`

describe("diffDocSource", () => {
  it("lists the changed lines with a few around them", () => {
    expect(diffDocSource(doc("Old."), doc("New."))).toMatchInlineSnapshot(`
      "@@ -1,6 +1,6 @@
       ---
       title: Footnotes
      -summary: Old.
      +summary: New.
       publishedAt: 2026-10-09
       ---
       "
    `)
  })

  it("is empty when nothing changed but the note", () => {
    expect(diffDocSource(doc("Same."), doc("Same.", "Explains nothing new."))).toBe("")
  })

  it("adds every line of a doc there's no copy of", () => {
    expect(diffDocSource("", "Hello\n")).toBe("@@ -1,0 +1,1 @@\n+Hello")
  })
})

describe("withoutChangeNote", () => {
  it("drops the note from the front matter, and only there", () => {
    const source = `${doc("Same.", "A note.")}changeNote: in the body\n`
    expect(withoutChangeNote(source)).toBe(`${doc("Same.")}changeNote: in the body\n`)
  })
})

describe("newChangeNote", () => {
  it("is the new copy's note", () => {
    expect(newChangeNote(doc("Old."), doc("New.", "Moved to Plugins."))).toBe("Moved to Plugins.")
    expect(newChangeNote(null, doc("New.", "Moved to Plugins."))).toBe("Moved to Plugins.")
  })

  it("is null when the note is the one the site already saw, or there's none", () => {
    expect(newChangeNote(doc("Old.", "Same note."), doc("New.", "Same note."))).toBeNull()
    expect(newChangeNote(doc("Old."), doc("New."))).toBeNull()
  })
})

describe("changedFiles", () => {
  it("lists files that are new or whose content changed", () => {
    expect(changedFiles({ a: "1", b: "2" }, { a: "1", b: "3", c: "4" })).toEqual(["b", "c"])
    expect(changedFiles(undefined, { a: "1" })).toEqual(["a"])
  })
})
