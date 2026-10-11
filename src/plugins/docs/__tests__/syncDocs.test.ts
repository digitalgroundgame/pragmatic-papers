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
 * A Payload whose find answers from `docs` and `media`, or from `removed` for the query for repo
 * docs that lost their file, and records what was written.
 */
const fakePayload = ({
  docs = [] as Record<string, unknown>[],
  media = [] as Record<string, unknown>[],
  removed = [] as Record<string, unknown>[],
} = {}) => {
  const payload = {
    find: vi.fn(async ({ collection, where }: { collection: string; where?: object }) => ({
      docs: collection === "media" ? media : where && "and" in where ? removed : docs,
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
      updated: [],
      unchanged: [],
      deleted: [],
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
      deleted: [],
    })

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
        data: expect.objectContaining({
          slug: "experiments",
          section: "site",
          revisedAt: null,
          navTitle: null,
          _status: "published",
          audience: [],
          showTableOfContents: true,
          sourceHash: hashRepoDoc("site", source, [hero, image]),
          heroImage: 41,
          content: { root: { children: [{ type: "upload", value: 41 }] } },
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

  it("skips a doc whose file and pictures hash the same as last time", async () => {
    const payload = fakePayload({
      docs: [{ id: 3, sourceHash: hashRepoDoc("site", source, [hero, image]) }],
    })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      updated: [],
      unchanged: ["experiments"],
      deleted: [],
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
      deleted: [],
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

describe("syncDocs pruning", () => {
  it("deletes a repo doc whose file is gone, and asks only for repo docs", async () => {
    const payload = fakePayload({ removed: [{ id: 7, slug: "old-name" }] })
    await expect(syncDocs(payload, dir)).resolves.toMatchObject({ deleted: ["old-name"] })
    expect(payload.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "docs",
        where: {
          and: [{ sourceHash: { exists: true } }, { slug: { not_in: ["experiments"] } }],
        },
      }),
    )
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "docs", id: 7, context: { disableRevalidate: true } }),
    )
  })

  it("deletes nothing when the folder holds no docs", async () => {
    await rm(path.join(dir, "site"), { recursive: true })
    const payload = fakePayload({ removed: [{ id: 7, slug: "old-name" }] })
    await expect(syncDocs(payload, dir)).resolves.toMatchObject({ deleted: [] })
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
