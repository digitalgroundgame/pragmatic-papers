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

  it("publishes a new doc with its pictures uploaded to Media", async () => {
    const result = await syncDocs(payload, dir)
    expect(result.created).toEqual([SLUG])

    const doc = await findDoc()
    expect(doc?._status).toBe("published")
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

  it("skips a doc that hasn't changed", async () => {
    const result = await syncDocs(payload, dir)
    expect(result).toEqual({ created: [], updated: [], unchanged: [SLUG] })
  })

  it("updates a changed doc without uploading its unchanged pictures again", async () => {
    const file = path.join(dir, SECTION, `${SLUG}.md`)
    const source = await readFile(file, "utf8")
    await writeFile(file, source.replace(/^summary: .*$/m, "summary: A new summary."))

    const result = await syncDocs(payload, dir)
    expect(result.updated).toEqual([SLUG])
    expect((await findDoc())?.summary).toBe("A new summary.")
    expect(await syncedMedia()).toHaveLength(2)
  })

  it("reuses a PNG it uploaded, though Media stored it as WebP", async () => {
    const folder = path.join(dir, SECTION)
    const file = path.join(folder, `${SLUG}.md`)
    const copy = `${SLUG}-hero-copy.png`
    await cp(path.join(folder, `${SLUG}-hero.webp`), path.join(folder, copy))
    const withPng = (await readFile(file, "utf8")).replace(/^heroImage: .*$/m, `heroImage: ${copy}`)
    await writeFile(file, withPng)
    await syncDocs(payload, dir)
    await writeFile(file, withPng.replace(/^summary: .*$/m, "summary: Changed again."))
    await syncDocs(payload, dir)

    const copies = (await syncedMedia()).filter((item) => item.filename?.includes("hero-copy"))
    expect(copies).toHaveLength(1)
    expect(copies[0]!.filename).toMatch(/\.webp$/)
  })

  it("leaves a synced doc read-only to editors, unlike one written in the admin", async () => {
    const editor = await createUser("editor")
    const doc = await findDoc()
    await expect(
      payload.update({
        collection: "docs",
        id: doc!.id,
        data: { summary: "Edited in the admin." },
        context: ctx,
        overrideAccess: false,
        user: editor,
      }),
    ).rejects.toThrow()

    const own = await payload.create({
      collection: "docs",
      context: ctx,
      overrideAccess: true,
      data: {
        title: "Written here",
        slug: "written-here",
        summary: "A doc from the admin.",
        publishedAt: "2026-10-18",
        heroImage: (await syncedMedia())[0]!.id,
        section: "writing",
        content: {
          root: {
            type: "root",
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Hello.", version: 1 }],
                version: 1,
              },
            ],
            direction: null,
            format: "",
            indent: 0,
            version: 1,
          },
        },
      },
    })
    const updated = await payload.update({
      collection: "docs",
      id: own.id,
      data: { summary: "Edited in the admin." },
      context: ctx,
      overrideAccess: false,
      user: editor,
    })
    expect(updated.summary).toBe("Edited in the admin.")
    await payload.delete({ collection: "docs", id: own.id, context: ctx, overrideAccess: true })
  })
})
