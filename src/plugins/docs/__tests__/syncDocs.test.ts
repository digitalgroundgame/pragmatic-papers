// @vitest-environment node
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Payload } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { hashRepoDoc, legacyRepoDocHash, mediaFilename } from "../repoDoc"
import { listDocFiles } from "../repoDocFiles"
import { planRepoDoc, type RepoDocState, syncDocs } from "../syncDocs"

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

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
/** The copy a sync keeps of `doc`, using the two pictures as they are on disk at first. */
const baseline = (doc: string) => ({
  hash: hashRepoDoc(doc, [hero, image]),
  source: doc,
  files: { "experiments-hero.png": sha(hero), "experiments-drawer.png": sha(image) },
})

/**
 * A Payload whose find answers from `docs` (those with the slug asked for, or with none),
 * and `media`, whose key-value store holds `kv` (a key, or a key and its value),
 * and which records what was written.
 */
const fakePayload = ({
  docs = [] as Record<string, unknown>[],
  media = [] as Record<string, unknown>[],
  kv = [] as (string | [string, unknown])[],
} = {}) => {
  let nextDoc = 1
  const store = new Map<string, unknown>(
    kv.map((entry) => (typeof entry === "string" ? [entry, { at: "then" }] : entry)),
  )
  const payload = {
    kv: {
      store,
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      has: vi.fn(async (key: string) => store.has(key)),
      set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
    },
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

describe("syncDocs", () => {
  it("warns and syncs nothing where the folder doesn't exist", async () => {
    const payload = fakePayload()
    await expect(syncDocs(payload, path.join(dir, "missing"))).resolves.toEqual({
      created: [],
      changed: [],
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
      changed: [],
      existing: [],
      deleted: [],
    })
    expect(payload.kv.store.has("seeded:docs:experiments")).toBe(true)
    // Its revision counts as offered, and its copy is kept for later changes to be measured against.
    expect(payload.kv.store.get("offered:docs:experiments")).toEqual({
      hash: hashRepoDoc(source, [hero, image]),
      at: expect.any(String),
    })
    expect(payload.kv.store.get("doc-source:docs:experiments")).toEqual(baseline(source))

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
          // At the top, as its file is.
          parent: null,
          revisedAt: null,
          navTitle: null,
          _status: "draft",
          audience: [],
          showTableOfContents: true,
          sourceHash: hashRepoDoc(source, [hero, image]),
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
      changed: [],
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
      path.join(dir, "experiments.md"),
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

  it("records a doc the site had before offers began as offered when it holds the repo's copy", async () => {
    const payload = fakePayload({
      docs: [{ id: 3, sourceHash: hashRepoDoc(source, [hero, image]) }],
    })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      changed: [],
      existing: ["experiments"],
      deleted: [],
    })
    // Recorded, so it stays deleted if an editor deletes it.
    expect(payload.kv.store.has("seeded:docs:experiments")).toBe(true)
    expect(payload.kv.store.get("offered:docs:experiments")).toEqual({
      hash: hashRepoDoc(source, [hero, image]),
      at: expect.any(String),
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it("leaves a doc alone that the repo changed before offers began, recording nothing", async () => {
    const payload = fakePayload({
      docs: [{ id: 3, sourceHash: "old" }],
      kv: ["seeded:docs:experiments"],
    })
    expect((await syncDocs(payload, dir)).changed).toEqual(["experiments"])
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    // The hash the doc was saved with stays the one the site took in.
    expect(payload.kv.store.has("offered:docs:experiments")).toBe(false)
    expect(payload.kv.store.has("doc-source:docs:experiments")).toBe(false)
  })

  it("leaves a doc alone when the repo's copy is the one it was last offered", async () => {
    const payload = fakePayload({
      docs: [{ id: 3 }],
      kv: [
        "seeded:docs:experiments",
        ["offered:docs:experiments", { hash: hashRepoDoc(source, [hero, image]) }],
        ["doc-source:docs:experiments", baseline(source)],
      ],
    })
    const result = await syncDocs(payload, dir)
    expect(result.existing).toEqual(["experiments"])
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.kv.set).not.toHaveBeenCalled()
  })

  it("keeps a copy of an unchanged doc seeded before copies were kept", async () => {
    const payload = fakePayload({
      docs: [{ id: 3 }],
      kv: [
        "seeded:docs:experiments",
        ["offered:docs:experiments", { hash: hashRepoDoc(source, [hero, image]) }],
      ],
    })
    expect((await syncDocs(payload, dir)).existing).toEqual(["experiments"])
    expect(payload.kv.store.get("doc-source:docs:experiments")).toEqual(baseline(source))
  })

  const changed = source.replace(
    "summary: Switch beta features on per site.",
    "summary: Switch beta features on per site, from Plugins.",
  )

  it("never changes a doc the site has when the repo's copy changes", async () => {
    await writeFile(path.join(dir, "experiments.md"), changed)
    await writeFile(path.join(dir, "experiments-drawer.png"), Buffer.from("a new drawer"))
    const offered = { hash: hashRepoDoc(source, [hero, image]), at: "then" }
    const payload = fakePayload({
      docs: [{ id: 3 }],
      kv: [
        "seeded:docs:experiments",
        ["offered:docs:experiments", offered],
        ["doc-source:docs:experiments", baseline(source)],
      ],
    })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      changed: ["experiments"],
      existing: [],
      deleted: [],
    })
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
    // The hash and the copy on file stay the ones the site took in, so every change since can
    // be measured against them.
    expect(payload.kv.set).not.toHaveBeenCalled()
    expect(payload.kv.store.get("offered:docs:experiments")).toEqual(offered)
    expect(payload.kv.store.get("doc-source:docs:experiments")).toEqual(baseline(source))
  })

  it("deletes nothing, even when the folder holds no docs", async () => {
    await rm(path.join(dir, "experiments.md"))
    const payload = fakePayload({ docs: [{ id: 7, slug: "old-name", sourceHash: "abc" }] })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      changed: [],
      existing: [],
      deleted: [],
    })
    expect(payload.delete).not.toHaveBeenCalled()
  })
})

describe("syncDocs in a tree", () => {
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
    expect((await syncDocs(payload, dir)).created).toEqual([
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

  it("files a new doc under the site's copy of its parent", async () => {
    const payload = fakePayload({
      docs: [
        { id: 30, slug: "editing" },
        { id: 31, slug: "site-settings" },
      ],
      kv: ["seeded:docs:editing", "seeded:docs:site-settings"],
    })
    await syncDocs(payload, dir)
    expect(createdDocs(payload)).toEqual([["experiments", 31]])
  })

  it("files it at the top when an editor deleted its parent", async () => {
    const payload = fakePayload({
      docs: [{ id: 30, slug: "editing" }],
      kv: ["seeded:docs:editing", "seeded:docs:site-settings"],
    })
    const result = await syncDocs(payload, dir)
    expect(result.deleted).toEqual(["site-settings"])
    expect(createdDocs(payload)).toEqual([["experiments", null]])
  })

  it("never moves or changes a doc the site has", async () => {
    const payload = fakePayload({
      docs: [
        { id: 30, slug: "editing" },
        { id: 31, slug: "site-settings" },
        { id: 32, slug: "experiments" },
      ],
      kv: [
        "seeded:docs:editing",
        "seeded:docs:site-settings",
        "seeded:docs:experiments",
        ["offered:docs:experiments", { hash: "old" }],
      ],
    })
    expect((await syncDocs(payload, dir)).changed).toEqual(["experiments"])
    expect(payload.update).not.toHaveBeenCalled()
    expect(createdDocs(payload)).toEqual([])
  })

  it("records the new hash for a doc saved with the hash that covered its section folder", async () => {
    const legacy = legacyRepoDocHash("site-settings", source, [hero, image])
    const payload = fakePayload({
      docs: [
        { id: 30, slug: "editing" },
        { id: 31, slug: "site-settings" },
        { id: 32, slug: "experiments", sourceHash: legacy },
      ],
      kv: [
        "seeded:docs:editing",
        "seeded:docs:site-settings",
        "seeded:docs:experiments",
        ["offered:docs:experiments", { hash: legacy, version: 4 }],
      ],
    })
    const result = await syncDocs(payload, dir)
    expect(result.changed).toEqual([])
    expect(result.existing).toContain("experiments")
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.kv.store.get("offered:docs:experiments")).toEqual({
      hash: hashRepoDoc(source, [hero, image]),
      at: expect.any(String),
    })
  })

  it("still reports a change to a doc whose old hash covered another folder or another copy", async () => {
    const payload = fakePayload({
      docs: [{ id: 32, slug: "experiments" }],
      kv: [
        "seeded:docs:experiments",
        [
          "offered:docs:experiments",
          { hash: legacyRepoDocHash("site-settings", `${source}Changed.\n`, [hero, image]) },
        ],
      ],
    })
    expect((await syncDocs(payload, dir)).changed).toEqual(["experiments"])
  })
})

describe("planRepoDoc", () => {
  const state = (overrides: Partial<RepoDocState> = {}): RepoDocState => ({
    exists: true,
    seeded: true,
    offered: { hash: "old", at: "then" },
    hash: "new",
    localSeed: false,
    ...overrides,
  })

  it("creates a doc the site has never had", () => {
    expect(planRepoDoc(state({ exists: false, seeded: false, offered: null }))).toBe("create")
  })

  it("leaves a deleted doc deleted, whatever the repo's copy says", () => {
    expect(planRepoDoc(state({ exists: false, offered: null }))).toBe("deleted")
    expect(planRepoDoc(state({ exists: false }))).toBe("deleted")
  })

  it("seeds a deleted doc again for the local seed", () => {
    expect(planRepoDoc(state({ exists: false, localSeed: true }))).toBe("create")
  })

  it("records a baseline for a doc never offered a revision that holds the repo's copy", () => {
    expect(planRepoDoc(state({ offered: null, sourceHash: "new" }))).toBe("baseline")
    expect(planRepoDoc(state({ offered: null, sourceHash: "new", seeded: false }))).toBe("baseline")
  })

  it("records a baseline for a doc an editor wrote, which has no source hash", () => {
    expect(planRepoDoc(state({ offered: null }))).toBe("baseline")
    expect(planRepoDoc(state({ offered: null, sourceHash: null }))).toBe("baseline")
  })

  it("reports a change made before offers began to a doc never offered a revision", () => {
    expect(planRepoDoc(state({ offered: null, sourceHash: "old" }))).toBe("changed")
  })

  it("does nothing when the repo's copy is the one last offered", () => {
    expect(planRepoDoc(state({ hash: "old" }))).toBe("unchanged")
  })

  it("reports a changed copy, whatever drafts the doc has", () => {
    expect(planRepoDoc(state())).toBe("changed")
    expect(planRepoDoc(state({ offered: { hash: "old", version: 4, at: "then" } }))).toBe("changed")
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
