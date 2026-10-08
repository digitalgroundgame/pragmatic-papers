import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"

import { DOCS_DIR, syncDocs } from "@/plugins/docs/syncDocs"
import type { RepoDoc } from "@/plugins/docs/repoDoc"
import { getPayload } from "./helpers/testUsers"

// The repo's own doc with a picture in it, synced from a copy so the test can change it.
const SLUG = "unsplash-photos"

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
        where: { filename: { like: `docs-${SLUG}-` } },
      })
    ).docs

  beforeAll(async () => {
    payload = await getPayload()
    dir = await mkdtemp(path.join(tmpdir(), "docs-"))
    await cp(path.join(DOCS_DIR, SLUG), path.join(dir, SLUG), { recursive: true })
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
    expect(media).toHaveLength(1)
    expect(JSON.stringify(doc?.content)).toContain(`"filename":"${media[0]!.filename}"`)
  })

  it("skips a doc that hasn't changed", async () => {
    const result = await syncDocs(payload, dir)
    expect(result).toEqual({ created: [], updated: [], unchanged: [SLUG] })
  })

  it("updates a changed doc without uploading its unchanged pictures again", async () => {
    const file = path.join(dir, SLUG, "doc.json")
    const repoDoc = JSON.parse(await readFile(file, "utf8")) as RepoDoc
    await writeFile(file, JSON.stringify({ ...repoDoc, summary: "A new summary." }))

    const result = await syncDocs(payload, dir)
    expect(result.updated).toEqual([SLUG])
    expect((await findDoc())?.summary).toBe("A new summary.")
    expect(await syncedMedia()).toHaveLength(1)
  })
})
