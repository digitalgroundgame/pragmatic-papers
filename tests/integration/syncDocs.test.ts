import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"

import { DOCS_DIR } from "@/plugins/docs/repoDocFiles"
import { syncDocs } from "@/plugins/docs/syncDocs"
import { createUser, getPayload } from "./helpers/testUsers"

// The repo's own doc with a picture in it, synced from a copy so the test can change it, in a
// tree of its own: an area and a section, each a doc of its own.
const SLUG = "unsplash-photos"
const SOURCE = "writing/media"
const AREA = "sync-test-area"
const SECTION = "sync-test-section"
const PARENTS = [AREA, SECTION]

type Result = Awaited<ReturnType<typeof syncDocs>>
/** What a sync did to the test's own docs, leaving out its area and section. */
const own = (result: Result): Result =>
  Object.fromEntries(
    Object.entries(result).map(([key, slugs]: [string, string[]]) => [
      key,
      slugs.filter((slug) => !PARENTS.includes(slug)),
    ]),
  ) as unknown as Result

describe("syncDocs", () => {
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

  const syncedMedia = async () =>
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
    for (const slug of [SLUG, "another", "and-another", ...PARENTS])
      for (const key of ["seeded", "offered"]) await payload.kv.delete(`${key}:docs:${slug}`)
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
      where: { slug: { in: PARENTS } },
    })
    await rm(dir, { recursive: true, force: true })
  })

  it("creates a new doc as a draft, with its pictures uploaded to Media", async () => {
    const result = await syncDocs(payload, dir)
    // Its area and section first, so it's filed under the section.
    expect(result.created).toEqual([AREA, SECTION, SLUG])

    const doc = await findDoc()
    expect(doc?._status).toBe("draft")
    const section = doc?.parent
    expect(typeof section === "object" && section?.slug).toBe(SECTION)
    // Under the section, under the area.
    expect(doc?.breadcrumbs?.at(-1)?.url).toBe(`/docs/${AREA}/${SECTION}/${SLUG}`)
    expect(doc?.publishedAt?.slice(0, 10)).toBe("2026-10-18")

    const media = await syncedMedia()
    const hero = doc?.heroImage
    expect(typeof hero === "object" && hero?.filename).toMatch(
      new RegExp(`^docs-[0-9a-f]{8}-${SLUG}-hero`),
    )
    const pictures = media.filter((item) => typeof hero !== "object" || item.id !== hero?.id)
    expect(pictures).toHaveLength(1)
    expect(JSON.stringify(doc?.content)).toContain(`"filename":"${pictures[0]!.filename}"`)
    expect(doc?.content.root.children[0]).toMatchObject({ type: "paragraph" })
  })

  it("keeps the draft from readers until someone publishes it", async () => {
    const { docs } = await payload.find({
      collection: "docs",
      overrideAccess: false,
      where: { slug: { equals: SLUG } },
    })
    expect(docs).toHaveLength(0)
  })

  const publishedDoc = async () =>
    (
      await payload.find({
        collection: "docs",
        depth: 0,
        overrideAccess: true,
        where: { slug: { equals: SLUG } },
      })
    ).docs[0]

  const setSummary = async (summary: string) => {
    const file = path.join(folder, `${SLUG}.md`)
    const source = await readFile(file, "utf8")
    await writeFile(file, source.replace(/^summary: .*$/m, `summary: ${summary}`))
  }

  it("offers the repo's change to a doc an editor published as a new draft, leaving the published doc as it is", async () => {
    const editor = await createUser("editor")
    const doc = await findDoc()
    const edited = await payload.update({
      collection: "docs",
      id: doc!.id,
      data: { summary: "Edited in the admin.", _status: "published" },
      context: ctx,
      overrideAccess: false,
      user: editor,
    })
    expect(edited.summary).toBe("Edited in the admin.")

    // Nothing changed in the repo: nothing to offer.
    expect(own(await syncDocs(payload, dir)).existing).toEqual([SLUG])

    await setSummary("A new summary.")
    const result = own(await syncDocs(payload, dir))
    expect(result).toEqual({
      created: [],
      offered: [SLUG],
      skipped: [],
      existing: [],
      deleted: [],
    })
    const published = await publishedDoc()
    expect(published?.summary).toBe("Edited in the admin.")
    expect(published?._status).toBe("published")
    const draft = await findDoc()
    expect(draft?.summary).toBe("A new summary.")
    expect(draft?._status).toBe("draft")
    expect(await syncedMedia()).toHaveLength(2)

    // Offered once: the next deploy leaves the suggestion (or its discarding) alone.
    expect(own(await syncDocs(payload, dir)).existing).toEqual([SLUG])

    // A newer change supersedes a suggestion nobody has touched, as another draft.
    await setSummary("A newer summary.")
    expect(own(await syncDocs(payload, dir)).offered).toEqual([SLUG])
    expect((await findDoc())?.summary).toBe("A newer summary.")
    expect((await publishedDoc())?.summary).toBe("Edited in the admin.")
  })

  it("leaves an editor's own draft alone, and offers the change once it's published", async () => {
    const editor = await createUser("editor")
    const doc = await findDoc()
    await payload.update({
      collection: "docs",
      id: doc!.id,
      data: { summary: "Published by an editor.", _status: "published" },
      context: ctx,
      overrideAccess: false,
      user: editor,
    })
    await payload.update({
      collection: "docs",
      id: doc!.id,
      data: { summary: "An editor's draft." },
      draft: true,
      context: ctx,
      overrideAccess: false,
      user: editor,
    })

    await setSummary("Yet another summary.")
    expect(own(await syncDocs(payload, dir)).skipped).toEqual([SLUG])
    expect((await findDoc())?.summary).toBe("An editor's draft.")

    await payload.update({
      collection: "docs",
      id: doc!.id,
      data: { _status: "published" },
      context: ctx,
      overrideAccess: false,
      user: editor,
    })
    expect(own(await syncDocs(payload, dir)).offered).toEqual([SLUG])
    expect((await findDoc())?.summary).toBe("Yet another summary.")
    expect((await publishedDoc())?.summary).toBe("An editor's draft.")
  })

  it("offers a doc seeded before offers began the change the repo made since", async () => {
    // Without an offer recorded, any draft is taken for an editor's: publish the suggestion.
    await payload.update({
      collection: "docs",
      id: (await findDoc())!.id,
      data: { _status: "published" },
      context: ctx,
      overrideAccess: true,
    })
    await payload.kv.delete(`offered:docs:${SLUG}`)
    // The repo's copy is the one the doc was saved with: nothing to offer.
    expect(own(await syncDocs(payload, dir)).existing).toEqual([SLUG])

    await payload.kv.delete(`offered:docs:${SLUG}`)
    await setSummary("Changed before offers began.")
    expect(own(await syncDocs(payload, dir)).offered).toEqual([SLUG])
    expect((await findDoc())?.summary).toBe("Changed before offers began.")
    expect((await publishedDoc())?.summary).toBe("Yet another summary.")
  })

  it("reuses a PNG it uploaded, though Media stored it as WebP", async () => {
    const copy = `${SLUG}-hero-copy.png`
    await cp(path.join(folder, `${SLUG}-hero.webp`), path.join(folder, copy))
    const source = await readFile(path.join(DOCS_DIR, SOURCE, `${SLUG}.md`), "utf8")
    const withPng = source.replace(/^heroImage: .*$/m, `heroImage: ${copy}`)
    await writeFile(path.join(folder, "another.md"), withPng)
    await writeFile(path.join(folder, "and-another.md"), withPng)
    expect(own(await syncDocs(payload, dir)).created).toEqual(["and-another", "another"])

    const copies = (await syncedMedia()).filter((item) => item.filename?.includes("hero-copy"))
    expect(copies).toHaveLength(1)
    expect(copies[0]!.filename).toMatch(/\.webp$/)
  })

  it("leaves a doc an editor deleted deleted, though its file is still there", async () => {
    await payload.delete({
      collection: "docs",
      overrideAccess: true,
      context: ctx,
      where: { slug: { equals: SLUG } },
    })
    const result = own(await syncDocs(payload, dir))
    expect(result).toEqual({
      created: [],
      offered: [],
      skipped: [],
      existing: ["and-another", "another"],
      deleted: [SLUG],
    })
    expect(await findDoc()).toBeUndefined()
  })

  it("never moves a doc: an editor's place for it outlasts the repo's changes", async () => {
    const editor = await createUser("editor")
    const doc = (await payload
      .find({
        collection: "docs",
        draft: true,
        overrideAccess: true,
        where: { slug: { equals: "and-another" } },
      })
      .then(({ docs }) => docs[0]))!
    // Moved to the top of the tree, and published there.
    await payload.update({
      collection: "docs",
      id: doc.id,
      data: { parent: null, _status: "published" },
      context: ctx,
      overrideAccess: false,
      user: editor,
    })
    const file = path.join(folder, "and-another.md")
    const source = await readFile(file, "utf8")
    await writeFile(file, source.replace(/^summary: .*$/m, "summary: Changed in the repo."))
    expect(own(await syncDocs(payload, dir)).offered).toEqual(["and-another"])
    const offered = await payload.findByID({
      collection: "docs",
      id: doc.id,
      draft: true,
      depth: 0,
      overrideAccess: true,
    })
    expect(offered.summary).toBe("Changed in the repo.")
    expect(offered.parent ?? null).toBeNull()
  })
  it("deletes nothing when a doc's file is gone", async () => {
    await rm(path.join(folder, "another.md"))
    const result = own(await syncDocs(payload, dir))
    expect(result.existing).toEqual(["and-another"])
    const { docs } = await payload.find({
      collection: "docs",
      draft: true,
      overrideAccess: true,
      where: { slug: { equals: "another" } },
    })
    expect(docs).toHaveLength(1)

    await payload.delete({
      collection: "docs",
      overrideAccess: true,
      context: ctx,
      where: { slug: { in: ["another", "and-another"] } },
    })
  })
})
