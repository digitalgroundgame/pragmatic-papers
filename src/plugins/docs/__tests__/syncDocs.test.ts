// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Payload } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { hashRepoDoc, mediaFilename } from "../repoDoc"
import { listDocFiles, planRepoDoc, type RepoDocState, syncDocs } from "../syncDocs"

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
 * A Payload whose find answers from `docs` and `media`, whose findVersions answers with
 * `versions` (newest first), whose key-value store holds `kv` (a key, or a key and its value),
 * and which records what was written.
 */
const fakePayload = ({
  docs = [] as Record<string, unknown>[],
  media = [] as Record<string, unknown>[],
  versions = [] as { id: number; version: { _status: "draft" | "published" } }[],
  kv = [] as (string | [string, unknown])[],
} = {}) => {
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
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "media" ? media : docs,
    })),
    findVersions: vi.fn(async () => ({ docs: versions })),
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
      offered: [],
      skipped: [],
      existing: [],
      deleted: [],
    })
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.stringContaining("doesn't exist"))
    expect(payload.find).not.toHaveBeenCalled()
  })

  it("creates a new doc as a draft, with its files uploaded and their ids in place", async () => {
    const payload = fakePayload({ versions: [{ id: 11, version: { _status: "draft" } }] })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: ["experiments"],
      offered: [],
      skipped: [],
      existing: [],
      deleted: [],
    })
    expect(payload.kv.store.has("seeded:docs:experiments")).toBe(true)
    // Its revision counts as offered, with the version it was saved as.
    expect(payload.kv.store.get("offered:docs:experiments")).toMatchObject({
      hash: hashRepoDoc("site", source, [hero, image]),
      version: 11,
    })

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
      offered: [],
      skipped: [],
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

  it("records a doc the site had before offers began as offered at the repo's copy, offering nothing", async () => {
    const payload = fakePayload({ docs: [{ id: 3, sourceHash: "old" }] })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      offered: [],
      skipped: [],
      existing: ["experiments"],
      deleted: [],
    })
    // Recorded, so it stays deleted if an editor deletes it.
    expect(payload.kv.store.has("seeded:docs:experiments")).toBe(true)
    expect(payload.kv.store.get("offered:docs:experiments")).toEqual({
      hash: hashRepoDoc("site", source, [hero, image]),
      at: expect.any(String),
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it("leaves a doc alone when the repo's copy is the one it was last offered", async () => {
    const payload = fakePayload({
      docs: [{ id: 3 }],
      kv: [
        "seeded:docs:experiments",
        ["offered:docs:experiments", { hash: hashRepoDoc("site", source, [hero, image]) }],
      ],
    })
    const result = await syncDocs(payload, dir)
    expect(result.existing).toEqual(["experiments"])
    expect(payload.findVersions).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("offers a changed repo copy as a new draft version, leaving the published doc as it is", async () => {
    const payload = fakePayload({
      docs: [{ id: 3 }],
      versions: [{ id: 20, version: { _status: "published" } }],
      kv: ["seeded:docs:experiments", ["offered:docs:experiments", { hash: "old", version: 4 }]],
    })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      offered: ["experiments"],
      skipped: [],
      existing: [],
      deleted: [],
    })
    expect(payload.update).toHaveBeenCalledOnce()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "docs",
        id: 3,
        draft: true,
        context: { disableRevalidate: true },
        data: expect.objectContaining({
          _status: "draft",
          sourceHash: hashRepoDoc("site", source, [hero, image]),
          heroImage: 41,
        }),
      }),
    )
    // Only its pictures are created: no new doc.
    expect(payload.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "docs" }))
    expect(payload.delete).not.toHaveBeenCalled()
    expect(payload.kv.store.get("offered:docs:experiments")).toMatchObject({
      hash: hashRepoDoc("site", source, [hero, image]),
      // The fake answers with the same latest version after the save.
      version: 20,
    })
  })

  it("skips a changed doc an editor has a draft of, and doesn't record it as offered", async () => {
    const offered = { hash: "old", version: 4 }
    const payload = fakePayload({
      docs: [{ id: 3 }],
      versions: [{ id: 5, version: { _status: "draft" } }],
      kv: ["seeded:docs:experiments", ["offered:docs:experiments", offered]],
    })
    const result = await syncDocs(payload, dir)
    expect(result.skipped).toEqual(["experiments"])
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.kv.store.get("offered:docs:experiments")).toBe(offered)
  })

  it("deletes nothing, even when the folder holds no docs", async () => {
    await rm(path.join(dir, "site"), { recursive: true })
    const payload = fakePayload({ docs: [{ id: 7, slug: "old-name", sourceHash: "abc" }] })
    await expect(syncDocs(payload, dir)).resolves.toEqual({
      created: [],
      offered: [],
      skipped: [],
      existing: [],
      deleted: [],
    })
    expect(payload.delete).not.toHaveBeenCalled()
  })
})

describe("planRepoDoc", () => {
  const state = (overrides: Partial<RepoDocState> = {}): RepoDocState => ({
    exists: true,
    seeded: true,
    offered: { hash: "old", version: 4, at: "then" },
    latest: { id: 4, status: "published" },
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

  it("records a baseline, offering nothing, for a doc never offered a revision", () => {
    expect(planRepoDoc(state({ offered: null }))).toBe("baseline")
    expect(planRepoDoc(state({ offered: null, seeded: false }))).toBe("baseline")
  })

  it("does nothing when the repo's copy is the one last offered, even once discarded", () => {
    expect(planRepoDoc(state({ hash: "old" }))).toBe("unchanged")
    expect(planRepoDoc(state({ hash: "old", latest: { id: 9, status: "draft" } }))).toBe(
      "unchanged",
    )
  })

  it("offers a changed copy when the latest version is published", () => {
    expect(planRepoDoc(state())).toBe("offer")
    expect(planRepoDoc(state({ offered: { hash: "old", at: "then" } }))).toBe("offer")
  })

  it("supersedes its own suggestion nobody has touched", () => {
    expect(planRepoDoc(state({ latest: { id: 4, status: "draft" } }))).toBe("offer")
    expect(planRepoDoc(state({ latest: { id: "4", status: "draft" } }))).toBe("offer")
  })

  it("skips a changed copy when the latest version is an editor's draft", () => {
    expect(planRepoDoc(state({ latest: { id: 5, status: "draft" } }))).toBe("editorDraft")
    // A draft from before offers were recorded with versions can't be told from an editor's.
    expect(
      planRepoDoc(
        state({ offered: { hash: "old", at: "then" }, latest: { id: 4, status: "draft" } }),
      ),
    ).toBe("editorDraft")
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
