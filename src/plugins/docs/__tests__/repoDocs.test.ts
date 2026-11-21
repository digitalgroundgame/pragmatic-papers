// @vitest-environment node
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { TOURS } from "@/plugins/tours"
import { imagesIn, parseDocFile } from "../docFile"
import { listDocFiles } from "../repoDocFiles"
import { docNavTitle, DOCS_PATH, HOME_DOC_SLUG, WHATS_NEW_PATH } from "../sections"

const docs = await listDocFiles()

/** Where each doc is read, from its place in the folders, as a site that seeds them all files it. */
const repoPaths = new Set([
  WHATS_NEW_PATH,
  ...docs.map(({ slug, urlPath }) =>
    slug === HOME_DOC_SLUG ? DOCS_PATH : `${DOCS_PATH}/${urlPath}`,
  ),
])

/** The area a doc sits in: the doc at the top of its branch. */
const areaOf = (slug: string): string => {
  const parent = docs.find((doc) => doc.slug === slug)?.parent
  return parent ? areaOf(parent) : slug
}

// A doc that fails here fails its deploy's sync instead, where nobody is watching.
describe.each(docs.map((doc) => [`${doc.urlPath}.md`, doc] as const))(
  "src/docs/%s",
  (name, { slug, parent, folder, file }) => {
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
      expect(docNavTitle(meta).trim()).toBeTruthy()
      expect(docNavTitle(meta).length).toBeLessThanOrEqual(24)
    })

    // A doc at the top of the tree is an area, which only introduces the docs under it.
    it.skipIf(slug === HOME_DOC_SLUG)("sits in an area, or is one with docs under it", () => {
      expect(parent !== null || existsSync(path.join(folder, slug))).toBe(true)
    })

    it("has a summary the Docs collection accepts", () => {
      expect(meta.summary.length).toBeLessThanOrEqual(200)
    })

    it.runIf(meta.tour !== undefined)("names a tour that exists", () => {
      expect(Object.keys(TOURS)).toContain(meta.tour)
    })

    // Admin-only docs have no area of their own: one writers aren't told about is editing work.
    // Areas and sections introduce docs for everyone, wherever they sit.
    it.skipIf(slug === HOME_DOC_SLUG || existsSync(path.join(folder, slug)))(
      "sits in Editing when, and only when, it's only for editors or admins",
      () => {
        const area = areaOf(slug)
        const forWriters = !meta.audience?.length || meta.audience.includes("writer")
        // A doc for everyone may sit in Reading or Writing; one writers aren't told about can't.
        expect(area === "editing").toBe(!forWriters)
      },
    )

    // An old address redirects, but a doc should link to where the other is now.
    it("links to other docs at their place in the tree", () => {
      for (const [, href] of body.matchAll(/\]\((\/docs[^)#\s]*)/g)) {
        expect(repoPaths, href).toContain(href!.replace(/\/$/, "") || DOCS_PATH)
      }
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
