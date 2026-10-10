// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { mediaRefsIn, type RepoDoc } from "../repoDoc"
import { DOC_SECTIONS } from "../sections"
import { DOCS_DIR } from "../syncDocs"

const slugs = readdirSync(DOCS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(DOCS_DIR, entry.name, "doc.json")))
  .map((entry) => entry.name)

// A doc that fails here fails its deploy's sync instead, where nobody is watching.
describe.each(slugs)("src/docs/%s", (slug) => {
  const folder = path.join(DOCS_DIR, slug)
  const doc = JSON.parse(readFileSync(path.join(folder, "doc.json"), "utf8")) as RepoDoc

  it("has a hero image, described for screen readers", () => {
    expect(doc.heroImage?.$media).toBeTruthy()
    expect(doc.heroImage.alt?.trim()).toBeTruthy()
  })

  it("has a short sidebar title", () => {
    expect(doc.navTitle?.trim()).toBeTruthy()
    expect(doc.navTitle!.length).toBeLessThanOrEqual(24)
  })

  it("sits in one of the sidebar's sections", () => {
    expect(DOC_SECTIONS.map((section) => section.value)).toContain(doc.section)
  })

  it("has every file it uses beside it", () => {
    for (const ref of mediaRefsIn([doc.heroImage, doc.content])) {
      expect(existsSync(path.join(folder, ref.$media)), ref.$media).toBe(true)
    }
  })
})
