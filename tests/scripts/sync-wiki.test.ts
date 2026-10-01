import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { listFiles, MARKER, mirror, refusal, syncMessage } from "../../scripts/sync-wiki"

describe("refusal", () => {
  const synced = {
    headMessage: syncMessage("o/r", "a".repeat(40)),
    headSummary: "abc",
    everSynced: true,
  }
  const edited = {
    headMessage: "Updated Home (markdown)",
    headSummary: "def by ana: Updated Home",
    everSynced: true,
  }

  it("lets a sync follow a sync", () => {
    expect(refusal(synced, false)).toBeUndefined()
  })

  it("refuses to overwrite a page edited on the wiki since the last sync", () => {
    expect(refusal(edited, false)).toContain(
      "edited directly since the last sync (def by ana: Updated Home)",
    )
  })

  it("overwrites it when forced", () => {
    expect(refusal(edited, true)).toBeUndefined()
  })

  it("lets the first sync through, since wiki/ was copied from the wiki", () => {
    expect(refusal({ ...edited, everSynced: false }, false)).toBeUndefined()
  })
})

describe("syncMessage", () => {
  it("names the repo commit, with the marker the next run looks for", () => {
    const message = syncMessage("o/r", "0123456789abcdef0123456789abcdef01234567")
    expect(message.split("\n")[0]).toBe("docs: sync from o/r@0123456")
    expect(message).toContain(`${MARKER}o/r@0123456789abcdef0123456789abcdef01234567`)
  })
})

describe("mirror", () => {
  const tree = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "wiki-"))
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true })
      writeFileSync(join(dir, path), content)
    }
    return dir
  }

  it("adds, updates and deletes pages, and leaves .git alone", () => {
    const source = tree({ "Home.md": "new home", "New-Page.md": "new", "images/a.png": "png" })
    const target = tree({ "Home.md": "old home", "Gone.md": "gone", ".git/HEAD": "ref" })
    mirror(source, target)
    expect(listFiles(target)).toEqual(["Home.md", "New-Page.md", "images/a.png"])
    expect(readFileSync(join(target, "Home.md"), "utf8")).toBe("new home")
    expect(readFileSync(join(target, ".git/HEAD"), "utf8")).toBe("ref")
  })
})
