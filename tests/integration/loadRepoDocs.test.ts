import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"

import { DOCS_DIR } from "@/plugins/docs/repoDocFiles"
import { loadRepoDocs } from "@/plugins/docs/loadRepoDocs"
import { getPayload } from "./helpers/testUsers"

// The repo's own doc with a picture in it, loaded from a copy so the test can change it, in a
// tree of its own: an area and a section, each a doc of its own.
const SLUG = "unsplash-photos"
const SOURCE = "writing/media"
const AREA = "sync-test-area"
const SECTION = "sync-test-section"
const PARENTS = [AREA, SECTION]

type Result = Awaited<ReturnType<typeof loadRepoDocs>>
/** What a load did to the test's own docs, leaving out its area and section. */
const own = (result: Result): Result =>
  Object.fromEntries(
    Object.entries(result).map(([key, slugs]: [string, string[]]) => [
      key,
      slugs.filter((slug) => !PARENTS.includes(slug)),
    ]),
  ) as unknown as Result

describe("loadRepoDocs", () => {
  let payload: Payload
  let dir: string
  let folder: string
  const ctx = { disableRevalidate: true }

  const findDoc = async () =>
    (
      await payload.find({
        collection: "docs",
        depth: 2,
        draft: true,
        overrideAccess: true,
        where: { slug: { equals: SLUG } },
      })
    ).docs[0]

  const loadedMedia = async () =>
    (
      await payload.find({
        collection: "media",
        depth: 0,
        overrideAccess: true,
        where: { filename: { like: `-${SLUG}-` } },
      })
    ).docs

  beforeAll(async () => {
    payload = await getPayload()
    dir = await mkdtemp(path.join(tmpdir(), "docs-"))
    folder = path.join(dir, AREA, SECTION)
    await mkdir(folder, { recursive: true })
    const intro = (title: string) =>
      `---\ntitle: ${title}\nsummary: The ${title.toLowerCase()}.\npublishedAt: 2026-10-25\n---\n\nIntro.\n`
    await writeFile(path.join(dir, `${AREA}.md`), intro("Test area"))
    await writeFile(path.join(dir, AREA, `${SECTION}.md`), intro("Test section"))
    for (const name of await readdir(path.join(DOCS_DIR, SOURCE))) {
      if (name.startsWith(`${SLUG}.`) || name.startsWith(`${SLUG}-`)) {
        await cp(path.join(DOCS_DIR, SOURCE, name), path.join(folder, name))
      }
    }
    await payload.delete({
      collection: "docs",
      overrideAccess: true,
      context: ctx,
      where: { slug: { in: [SLUG, ...PARENTS] } },
    })
  })

  afterAll(async () => {
    await payload.delete({
      collection: "docs",
      overrideAccess: true,
      context: ctx,
      where: { slug: { in: [SLUG, ...PARENTS] } },
    })
    await rm(dir, { recursive: true, force: true })
  })

  it("creates a new doc published, with its pictures uploaded to Media", async () => {
    const result = await loadRepoDocs(payload, dir)
    // Its area and section first, so it's filed under the section.
    expect(result.created).toEqual([AREA, SECTION, SLUG])

    const doc = await findDoc()
    expect(doc?._status).toBe("published")
    const section = doc?.parent
    expect(typeof section === "object" && section?.slug).toBe(SECTION)
    // Under the section, under the area.
    expect(doc?.breadcrumbs?.at(-1)?.url).toBe(`/docs/${AREA}/${SECTION}/${SLUG}`)
    expect(doc?.publishedAt?.slice(0, 10)).toBe("2026-10-18")

    const media = await loadedMedia()
    const hero = doc?.heroImage
    expect(typeof hero === "object" && hero?.filename).toMatch(
      new RegExp(`^docs-[0-9a-f]{8}-${SLUG}-hero`),
    )
    const pictures = media.filter((item) => typeof hero !== "object" || item.id !== hero?.id)
    expect(pictures).toHaveLength(1)
    expect(JSON.stringify(doc?.content)).toContain(`"filename":"${pictures[0]!.filename}"`)
    expect(doc?.content.root.children[0]).toMatchObject({ type: "paragraph" })
  })

  it("leaves the docs it finds as they are", async () => {
    const doc = await findDoc()
    await payload.update({
      collection: "docs",
      id: doc!.id,
      data: { summary: "Edited in the admin." },
      context: ctx,
      overrideAccess: true,
    })
    expect(own(await loadRepoDocs(payload, dir))).toEqual({ created: [], existing: [SLUG] })
    expect((await findDoc())?.summary).toBe("Edited in the admin.")
  })

  it("reuses a PNG it uploaded, though Media stored it as WebP", async () => {
    const copy = `${SLUG}-hero-copy.png`
    await cp(path.join(folder, `${SLUG}-hero.webp`), path.join(folder, copy))
    const source = await readFile(path.join(DOCS_DIR, SOURCE, `${SLUG}.md`), "utf8")
    const withPng = source.replace(/^heroImage: .*$/m, `heroImage: ${copy}`)
    await writeFile(path.join(folder, "another.md"), withPng)
    await writeFile(path.join(folder, "and-another.md"), withPng)
    expect(own(await loadRepoDocs(payload, dir)).created).toEqual(["and-another", "another"])

    const copies = (await loadedMedia()).filter((item) => item.filename?.includes("hero-copy"))
    expect(copies).toHaveLength(1)
    expect(copies[0]!.filename).toMatch(/\.webp$/)

    await payload.delete({
      collection: "docs",
      overrideAccess: true,
      context: ctx,
      where: { slug: { in: ["another", "and-another"] } },
    })
  })
})
