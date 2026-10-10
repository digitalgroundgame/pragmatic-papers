// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Payload } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { hashRepoDoc, mediaFilename } from "../repoDoc"
import { syncDocs } from "../syncDocs"

const image = Buffer.from("not really a png")
const hero = Buffer.from("not really a hero image either")
const doc = {
  title: "Experiments",
  summary: "Switch beta features on per site.",
  publishedAt: "2026-10-09",
  heroImage: { $media: "hero.png", alt: "Switches" },
  section: "site",
  content: {
    root: { children: [{ type: "upload", value: { $media: "drawer.png", alt: "Drawer" } }] },
  },
}
const json = `${JSON.stringify(doc)}\n`

let dir: string

/** A Payload whose find answers from `docs` and `media`, and records what was written. */
const fakePayload = ({
  docs = [] as Record<string, unknown>[],
  media = [] as Record<string, unknown>[],
} = {}) => {
  const payload = {
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "media" ? media : docs,
    })),
    create: vi.fn(async ({ collection }: { collection: string }) => ({
      id: collection === "media" ? 41 : 1,
    })),
    update: vi.fn(async () => ({})),
    logger: { warn: vi.fn() },
  }
  return payload as typeof payload & Payload
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "docs-"))
  await mkdir(path.join(dir, "experiments"))
  await writeFile(path.join(dir, "experiments", "doc.json"), json)
  await writeFile(path.join(dir, "experiments", "drawer.png"), image)
  await writeFile(path.join(dir, "experiments", "hero.png"), hero)
  // A folder without a doc.json isn't a doc.
  await mkdir(path.join(dir, "drafts"))
})

afterEach(() => rm(dir, { recursive: true, force: true }))

describe("syncDocs", () => {
  it("warns and syncs nothing where the folder doesn't exist", async () => {
    const payload = fakePayload()
    await expect(syncDocs(payload, path.join(dir, "missing"))).resolves.toEqual({
      created: [],
      updated: [],
      unchanged: [],
    })
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.stringContaining("doesn't exist"))
    expect(payload.find).not.toHaveBeenCalled()
  })

  it("creates a new doc, published, with its files uploaded and their ids in place", async () => {
    const payload = fakePayload()
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: ["experiments"],
      updated: [],
      unchanged: [],
    })

    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "media",
        data: { alt: "Drawer" },
        file: expect.objectContaining({
          name: mediaFilename("experiments", "drawer.png", image),
          mimetype: "image/png",
        }),
      }),
    )
    expect(payload.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "docs",
        context: { disableRevalidate: true },
        data: expect.objectContaining({
          slug: "experiments",
          section: "site",
          _status: "published",
          audience: [],
          showTableOfContents: true,
          sourceHash: hashRepoDoc(json, [hero, image]),
          heroImage: 41,
          content: { root: { children: [{ type: "upload", value: 41 }] } },
        }),
      }),
    )
  })

  it("skips a doc whose JSON and files hash the same as last time", async () => {
    const payload = fakePayload({
      docs: [{ id: 3, sourceHash: hashRepoDoc(json, [hero, image]) }],
    })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      updated: [],
      unchanged: ["experiments"],
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("updates a changed doc in place, reusing a file it already uploaded", async () => {
    const payload = fakePayload({ docs: [{ id: 3, sourceHash: "old" }], media: [{ id: 9 }] })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      updated: ["experiments"],
      unchanged: [],
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "docs",
        id: 3,
        data: expect.objectContaining({
          heroImage: 9,
          content: { root: { children: [{ type: "upload", value: 9 }] } },
        }),
      }),
    )
  })
})
