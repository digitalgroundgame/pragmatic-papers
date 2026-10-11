// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Payload } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { hashRepoDoc, mediaFilename } from "../repoDoc"
import { listDocFiles, syncDocs } from "../syncDocs"

// The editor's own conversion is tested against the real config in markdown.test.ts.
vi.mock("../markdown", () => ({
  docsEditorConfig: () => ({}),
  markdownToContent: (_slug: string, body: string) => ({
    root: {
      children: body.split("\n").flatMap((line) => {
        const image = /^!\[(.*)\]\((.*)\)$/.exec(line)
        return image ? [{ type: "upload", value: { $media: image[2], alt: image[1] } }] : []
      }),
    },
  }),
}))

const image = Buffer.from("not really a png")
const hero = Buffer.from("not really a hero image either")
const source = `---
title: Experiments
summary: Switch beta features on per site.
publishedAt: 2026-10-09
heroImage: experiments-hero.png
heroAlt: Switches
---

![Drawer](experiments-drawer.png)
`

let dir: string

/**
 * A Payload whose find answers from `docs` and `media`, whose key-value store holds `kv`, and
 * which records what was written.
 */
const fakePayload = ({
  docs = [] as Record<string, unknown>[],
  media = [] as Record<string, unknown>[],
  kv = [] as string[],
} = {}) => {
  const keys = new Set(kv)
  const payload = {
    kv: {
      keys,
      has: vi.fn(async (key: string) => keys.has(key)),
      set: vi.fn(async (key: string) => void keys.add(key)),
    },
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "media" ? media : docs,
    })),
    create: vi.fn(async ({ collection }: { collection: string }) => ({
      id: collection === "media" ? 41 : 1,
    })),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    logger: { warn: vi.fn() },
  }
  return payload as typeof payload & Payload
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "docs-"))
  await mkdir(path.join(dir, "site"))
  await writeFile(path.join(dir, "site", "experiments.md"), source)
  await writeFile(path.join(dir, "site", "experiments-drawer.png"), image)
  await writeFile(path.join(dir, "site", "experiments-hero.png"), hero)
  // A folder without Markdown in it isn't a section.
  await mkdir(path.join(dir, "drafts"))
})

afterEach(() => rm(dir, { recursive: true, force: true }))

describe("syncDocs", () => {
  it("warns and syncs nothing where the folder doesn't exist", async () => {
    const payload = fakePayload()
    await expect(syncDocs(payload, path.join(dir, "missing"))).resolves.toEqual({
      created: [],
      existing: [],
      deleted: [],
    })
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.stringContaining("doesn't exist"))
    expect(payload.find).not.toHaveBeenCalled()
  })

  it("creates a new doc as a draft, with its files uploaded and their ids in place", async () => {
    const payload = fakePayload()
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: ["experiments"],
      existing: [],
      deleted: [],
    })
    expect(payload.kv.keys).toContain("seeded:docs:experiments")

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "docs", where: { slug: { equals: "experiments" } } }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "media",
        data: { alt: "Drawer" },
        file: expect.objectContaining({
          name: mediaFilename("experiments-drawer.png", image),
          mimetype: "image/png",
        }),
      }),
    )
    expect(payload.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "docs",
        context: { disableRevalidate: true },
        draft: true,
        data: expect.objectContaining({
          slug: "experiments",
          section: "site",
          revisedAt: null,
          navTitle: null,
          _status: "draft",
          audience: [],
          showTableOfContents: true,
          sourceHash: hashRepoDoc("site", source, [hero, image]),
          heroImage: 41,
          content: { root: { children: [{ type: "upload", value: 41 }] } },
        }),
      }),
    )
  })

  it("leaves a doc it seeded before and an editor deleted since deleted", async () => {
    const payload = fakePayload({ kv: ["seeded:docs:experiments"] })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      existing: [],
      deleted: ["experiments"],
    })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it("publishes what it creates for the local seed, and seeds a doc it seeded before again", async () => {
    const payload = fakePayload({ kv: ["seeded:docs:experiments"] })
    await syncDocs(payload, dir, { localSeed: true })
    expect(payload.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "docs",
        draft: false,
        data: expect.objectContaining({ _status: "published" }),
      }),
    )
  })

  it("reuses a file it already uploaded", async () => {
    const payload = fakePayload({ media: [{ id: 9 }] })
    await syncDocs(payload, dir)
    expect(payload.create).toHaveBeenCalledOnce()
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "docs",
        data: expect.objectContaining({
          heroImage: 9,
          content: { root: { children: [{ type: "upload", value: 9 }] } },
        }),
      }),
    )
  })

  it("creates a doc with no hero image", async () => {
    await writeFile(
      path.join(dir, "site", "experiments.md"),
      source.replace("heroImage: experiments-hero.png\nheroAlt: Switches\n", ""),
    )
    const payload = fakePayload()
    await syncDocs(payload, dir)
    expect(payload.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "docs",
        data: expect.objectContaining({ slug: "experiments", heroImage: null }),
      }),
    )
  })

  it("leaves a doc the site already has alone, whatever the repo's copy says now", async () => {
    const payload = fakePayload({ docs: [{ id: 3, sourceHash: "old" }] })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      existing: ["experiments"],
      deleted: [],
    })
    // Recorded, so it stays deleted if an editor deletes it.
    expect(payload.kv.keys).toContain("seeded:docs:experiments")
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it("deletes nothing, even when the folder holds no docs", async () => {
    await rm(path.join(dir, "site"), { recursive: true })
    const payload = fakePayload({ docs: [{ id: 7, slug: "old-name", sourceHash: "abc" }] })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      existing: [],
      deleted: [],
    })
    expect(payload.delete).not.toHaveBeenCalled()
  })
})

describe("listDocFiles", () => {
  it("finds each section's docs", async () => {
    await expect(listDocFiles(dir)).resolves.toEqual([
      {
        slug: "experiments",
        section: "site",
        folder: path.join(dir, "site"),
        file: path.join(dir, "site", "experiments.md"),
      },
    ])
  })

  it("finds the home doc at the top, in the default section", async () => {
    await writeFile(path.join(dir, "home.md"), source)
    await expect(listDocFiles(dir)).resolves.toContainEqual({
      slug: "home",
      section: "getting-started",
      folder: dir,
      file: path.join(dir, "home.md"),
    })
  })

  it("refuses any other doc outside a section", async () => {
    await writeFile(path.join(dir, "stray.md"), source)
    await expect(listDocFiles(dir)).rejects.toThrow(/stray\.md should be in a section's folder/)
  })

  it("refuses a folder that isn't a section", async () => {
    await writeFile(path.join(dir, "drafts", "idea.md"), source)
    await expect(listDocFiles(dir)).rejects.toThrow(/drafts\/ isn't a section/)
  })

  it("refuses two docs with one slug", async () => {
    await mkdir(path.join(dir, "blocks"))
    await writeFile(path.join(dir, "blocks", "experiments.md"), source)
    await expect(listDocFiles(dir)).rejects.toThrow(/Two docs are called "experiments"/)
  })
})
