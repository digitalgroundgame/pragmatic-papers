// @vitest-environment node
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { imagesIn, parseDocFile } from "../docFile"
import { DOC_SECTIONS, HOME_DOC_SLUG } from "../sections"
import { DOCS_DIR, listDocFiles } from "../syncDocs"
import { TOURS } from "@/plugins/tours"

const docs = await listDocFiles()

// A doc that fails here fails its deploy's sync instead, where nobody is watching.
describe.each(docs.map((doc) => [path.relative(DOCS_DIR, doc.file), doc] as const))(
  "src/docs/%s",
  (name, { slug, section, folder, file }) => {
    const { meta, body } = parseDocFile(readFileSync(file, "utf8"), name)

    // A hero image is optional.
    it.skipIf(!meta.heroImage)(
      "names its hero image for the doc, described for screen readers",
      () => {
        expect(meta.heroImage).toMatch(new RegExp(`^${slug}-hero\\.`))
        expect(meta.heroAlt?.trim()).toBeTruthy()
      },
    )

    it("has a short sidebar title", () => {
      expect(meta.navTitle?.trim()).toBeTruthy()
      expect(meta.navTitle!.length).toBeLessThanOrEqual(24)
    })

    it.runIf(meta.tour !== undefined)("names a tour that exists", () => {
      expect(Object.keys(TOURS)).toContain(meta.tour)
    })

    // Admin-only docs have no area of their own: one writers aren't told about is editing work.
    it.skipIf(slug === HOME_DOC_SLUG)(
      "sits in Editing when, and only when, it's only for editors or admins",
      () => {
        const area = DOC_SECTIONS.find((known) => known.value === section)?.area
        const forWriters = !meta.audience?.length || meta.audience.includes("writer")
        // A doc for everyone may sit in Reading or Writing; one writers aren't told about can't.
        expect(area === "editing").toBe(!forWriters)
      },
    )

    it("has every picture it shows beside it, named for the doc", () => {
      for (const { file: picture, alt } of imagesIn(body)) {
        expect(picture).toMatch(new RegExp(`^${slug}-`))
        expect(existsSync(path.join(folder, picture)), picture).toBe(true)
        expect(alt.trim(), picture).toBeTruthy()
      }
      if (meta.heroImage) {
        expect(existsSync(path.join(folder, meta.heroImage)), meta.heroImage).toBe(true)
      }
    })
  },
)
