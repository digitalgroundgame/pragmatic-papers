import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"

import { DOCS_DIR, syncDocs } from "@/plugins/docs/syncDocs"
import { createUser, getPayload } from "./helpers/testUsers"

// The repo's own doc with a picture in it, synced from a copy so the test can change it.
const SLUG = "unsplash-photos"
const SECTION = "media"

describe("syncDocs", () => {
  let payload: Payload
  let dir: string
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
    dir = await mkdtemp(path.join(tmpdir(), "docs-"))
    await mkdir(path.join(dir, SECTION))
    for (const name of await readdir(path.join(DOCS_DIR, SECTION))) {
      if (name.startsWith(`${SLUG}.`) || name.startsWith(`${SLUG}-`)) {
        await cp(path.join(DOCS_DIR, SECTION, name), path.join(dir, SECTION, name))
      }
    }
    await payload.delete({
      collection: "docs",
      overrideAccess: true,
      context: ctx,
      where: { slug: { equals: SLUG } },
    })
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it("creates a new doc as a draft, with its pictures uploaded to Media", async () => {
    const result = await syncDocs(payload, dir)
    expect(result.created).toEqual([SLUG])

    const doc = await findDoc()
    expect(doc?._status).toBe("draft")
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

  it("lets editors change a seeded doc, and never overwrites it from the repo", async () => {
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

    const file = path.join(dir, SECTION, `${SLUG}.md`)
    const source = await readFile(file, "utf8")
    await writeFile(file, source.replace(/^summary: .*$/m, "summary: A new summary."))

    const result = await syncDocs(payload, dir)
    expect(result).toEqual({ created: [], existing: [SLUG] })
    const after = await findDoc()
    expect(after?.summary).toBe("Edited in the admin.")
    expect(after?._status).toBe("published")
    expect(await syncedMedia()).toHaveLength(2)
  })

  it("deletes nothing when a doc's file is gone", async () => {
    await rm(path.join(dir, SECTION, `${SLUG}.md`))
    const result = await syncDocs(payload, dir)
    expect(result).toEqual({ created: [], existing: [] })
    expect(await findDoc()).toBeDefined()
  })

  it("seeds a doc deleted in the admin again, reusing a PNG Media stored as WebP", async () => {
    const folder = path.join(dir, SECTION)
    const copy = `${SLUG}-hero-copy.png`
    await cp(path.join(folder, `${SLUG}-hero.webp`), path.join(folder, copy))
    const source = await readFile(path.join(DOCS_DIR, SECTION, `${SLUG}.md`), "utf8")
    await writeFile(
      path.join(folder, "another.md"),
      source.replace(/^heroImage: .*$/m, `heroImage: ${copy}`),
    )
    expect((await syncDocs(payload, dir)).created).toEqual(["another"])

    await payload.delete({
      collection: "docs",
      overrideAccess: true,
      context: ctx,
      where: { slug: { equals: "another" } },
    })
    expect((await syncDocs(payload, dir)).created).toEqual(["another"])

    const copies = (await syncedMedia()).filter((item) => item.filename?.includes("hero-copy"))
    expect(copies).toHaveLength(1)
    expect(copies[0]!.filename).toMatch(/\.webp$/)

    await payload.delete({
      collection: "docs",
      overrideAccess: true,
      context: ctx,
      where: { slug: { in: [SLUG, "another"] } },
    })
  })
})
