// @vitest-environment node
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { imagesIn, parseDocFile } from "../docFile"
import { DOCS_DIR, listDocFiles } from "../syncDocs"

const docs = await listDocFiles()

// A doc that fails here fails its deploy's sync instead, where nobody is watching.
describe.each(docs.map((doc) => [path.relative(DOCS_DIR, doc.file), doc] as const))(
  "src/docs/%s",
  (name, { slug, folder, file }) => {
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
