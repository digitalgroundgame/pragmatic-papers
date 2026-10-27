// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Payload } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loadRepoDocs } from "../loadRepoDocs"
import { mediaFilename } from "../repoDoc"
import { listDocFiles } from "../repoDocFiles"

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
 * A Payload whose find answers from `docs` (those with the slug asked for, or with none) and
 * `media`, and which records what was written.
 */
const fakePayload = ({
  docs = [] as Record<string, unknown>[],
  media = [] as Record<string, unknown>[],
} = {}) => {
  let nextDoc = 1
  const payload = {
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string
        where?: { slug?: { equals?: string } }
      }) => ({
        docs:
          collection === "media"
            ? media
            : docs.filter((doc) => !doc.slug || doc.slug === where?.slug?.equals),
      }),
    ),
    create: vi.fn(async ({ collection }: { collection: string }) => ({
      id: collection === "media" ? 41 : nextDoc++,
    })),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    logger: { warn: vi.fn() },
  }
  return payload as typeof payload & Payload
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "docs-"))
  await writeFile(path.join(dir, "experiments.md"), source)
  await writeFile(path.join(dir, "experiments-drawer.png"), image)
  await writeFile(path.join(dir, "experiments-hero.png"), hero)
})

afterEach(() => rm(dir, { recursive: true, force: true }))

describe("loadRepoDocs", () => {
  it("warns and loads nothing where the folder doesn't exist", async () => {
    const payload = fakePayload()
    await expect(loadRepoDocs(payload, path.join(dir, "missing"))).resolves.toEqual({
      created: [],
      existing: [],
    })
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.stringContaining("doesn't exist"))
    expect(payload.find).not.toHaveBeenCalled()
  })

  it("creates a doc published, with its files uploaded and their ids in place", async () => {
    const payload = fakePayload()
    await expect(loadRepoDocs(payload, dir)).resolves.toEqual({
      created: ["experiments"],
      existing: [],
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
          // At the top, as its file is.
          parent: null,
          revisedAt: null,
          navTitle: null,
          _status: "published",
          audience: [],
          showTableOfContents: true,
          heroImage: 41,
          content: { root: { children: [{ type: "upload", value: 41 }] } },
        }),
      }),
    )
  })

  it("reuses a file it already uploaded", async () => {
    const payload = fakePayload({ media: [{ id: 9 }] })
    await loadRepoDocs(payload, dir)
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
      path.join(dir, "experiments.md"),
      source.replace("heroImage: experiments-hero.png\nheroAlt: Switches\n", ""),
    )
    const payload = fakePayload()
    await loadRepoDocs(payload, dir)
    expect(payload.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "docs",
        data: expect.objectContaining({ slug: "experiments", heroImage: null }),
      }),
    )
  })

  it("leaves a doc the database already has as it is", async () => {
    const payload = fakePayload({ docs: [{ id: 3, slug: "experiments" }] })
    await expect(loadRepoDocs(payload, dir)).resolves.toEqual({
      created: [],
      existing: ["experiments"],
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })
})

describe("loadRepoDocs in a tree", () => {
  const section = (title: string) => `---
title: ${title}
summary: The docs on ${title.toLowerCase()}.
publishedAt: 2026-10-25
---

Intro.
`
  beforeEach(async () => {
    await writeFile(path.join(dir, "editing.md"), section("Editing"))
    await mkdir(path.join(dir, "editing", "site-settings"), { recursive: true })
    await writeFile(path.join(dir, "editing", "site-settings.md"), section("Site settings"))
    await rm(path.join(dir, "experiments.md"))
    await writeFile(path.join(dir, "editing", "site-settings", "experiments.md"), source)
    for (const [name, bytes] of [
      ["experiments-drawer.png", image],
      ["experiments-hero.png", hero],
    ] as const) {
      await writeFile(path.join(dir, "editing", "site-settings", name), bytes)
    }
  })

  const createdDocs = (payload: ReturnType<typeof fakePayload>) =>
    payload.create.mock.calls
      .map(([args]) => args as unknown as { collection: string; data: Record<string, unknown> })
      .filter((args) => args.collection === "docs")
      .map(({ data }) => [data.slug, data.parent])

  it("creates each doc under the one its folder names, parents first", async () => {
    const payload = fakePayload()
    expect((await loadRepoDocs(payload, dir)).created).toEqual([
      "editing",
      "site-settings",
      "experiments",
    ])
    expect(createdDocs(payload)).toEqual([
      ["editing", null],
      ["site-settings", 1],
      ["experiments", 2],
    ])
  })

  it("files a new doc under the database's copy of its parent", async () => {
    const payload = fakePayload({
      docs: [
        { id: 30, slug: "editing" },
        { id: 31, slug: "site-settings" },
      ],
    })
    await loadRepoDocs(payload, dir)
    expect(createdDocs(payload)).toEqual([["experiments", 31]])
  })
})

describe("listDocFiles", () => {
  const doc = (title: string, order?: number) =>
    `---\ntitle: ${title}\nsummary: About ${title}.\npublishedAt: 2026-10-25\n${
      order === undefined ? "" : `order: ${order}\n`
    }---\n\nText.\n`

  it("finds a doc at the top, under no other", async () => {
    await expect(listDocFiles(dir)).resolves.toEqual([
      {
        slug: "experiments",
        parent: null,
        folder: dir,
        file: path.join(dir, "experiments.md"),
      },
    ])
  })

  it("lists each doc before the docs in its folder, siblings in their order, then by slug", async () => {
    await writeFile(path.join(dir, "home.md"), doc("Home"))
    await writeFile(path.join(dir, "writing.md"), doc("Writing", 1))
    await mkdir(path.join(dir, "writing"))
    await writeFile(path.join(dir, "writing", "media.md"), doc("Media", 2))
    await writeFile(path.join(dir, "writing", "articles.md"), doc("Articles", 1))
    await writeFile(path.join(dir, "writing", "blocks.md"), doc("Blocks"))
    const entries = await listDocFiles(dir)
    expect(entries.map((entry) => [entry.slug, entry.parent])).toEqual([
      ["writing", null],
      ["articles", "writing"],
      ["media", "writing"],
      ["blocks", "writing"],
      ["experiments", null],
      ["home", null],
    ])
    expect(entries[1]!.folder).toBe(path.join(dir, "writing"))
  })

  it("refuses a folder with no doc beside it", async () => {
    await mkdir(path.join(dir, "drafts"))
    await writeFile(path.join(dir, "drafts", "idea.md"), source)
    await expect(listDocFiles(dir)).rejects.toThrow(
      /drafts\/ holds docs, but there's no drafts\.md/,
    )
  })

  it("refuses a home doc anywhere but the top, and docs under it", async () => {
    await mkdir(path.join(dir, "experiments"))
    await writeFile(path.join(dir, "experiments", "home.md"), source)
    await expect(listDocFiles(dir)).rejects.toThrow(/the home doc belongs at the top/)
    await rm(path.join(dir, "experiments"), { recursive: true })
    await writeFile(path.join(dir, "home.md"), source)
    await mkdir(path.join(dir, "home"))
    await writeFile(path.join(dir, "home", "idea.md"), source)
    await expect(listDocFiles(dir)).rejects.toThrow(/no docs sit under the home doc/)
  })

  it("refuses two docs with one slug", async () => {
    await writeFile(path.join(dir, "blocks.md"), doc("Blocks"))
    await mkdir(path.join(dir, "blocks"))
    await writeFile(path.join(dir, "blocks", "experiments.md"), source)
    await expect(listDocFiles(dir)).rejects.toThrow(/Two docs are called "experiments"/)
  })
})
