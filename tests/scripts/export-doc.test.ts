import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as RepoDocFiles from "@/plugins/docs/repoDocFiles"

const { find, destroy, dir } = vi.hoisted(() => ({
  find: vi.fn(),
  destroy: vi.fn(),
  dir: { docs: "", cwd: "" },
}))

vi.mock("dotenv/config", () => ({}))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: async () => ({ find, db: { destroy } }) }))
// The editor's own conversion is tested against the real config in markdown.test.ts.
vi.mock("@/plugins/docs/markdown", () => ({
  docsEditorConfig: () => ({}),
  contentToMarkdown: (content: { root?: { children: { value: { $media: string } }[] } }) =>
    (content.root?.children ?? []).map((node) => `![](${node.value.$media})`).join("\n\n"),
}))
vi.mock("@/plugins/docs/repoDocFiles", async (importOriginal) => ({
  ...(await importOriginal<typeof RepoDocFiles>()),
  get DOCS_DIR() {
    return dir.docs
  },
}))

const { main } = await import("../../scripts/export-doc")

const image = {
  id: 9,
  filename: "search.webp",
  mimeType: "image/webp",
  alt: "The search drawer",
  url: "/api/media/file/search.webp",
}
const doc = {
  title: "Find photos",
  summary: "Search Unsplash.",
  publishedAt: "2026-10-18T00:00:00.000Z",
  heroImage: image,
  // Under Writing, then Media; the doc itself last.
  breadcrumbs: [
    { doc: { slug: "writing" } },
    { doc: { slug: "media" } },
    { doc: { slug: "photos" } },
  ],
  audience: [],
  showTableOfContents: true,
  content: { root: { children: [{ type: "upload", value: image }] } },
}

const exported = async (slug = "photos", folder = "writing/media") =>
  readFile(path.join(dir.docs, folder, `${slug}.md`), "utf8")

const docFile = (title: string, extra = "") =>
  `---\ntitle: ${title}\nsummary: About ${title}.\npublishedAt: 2026-10-25\n${extra}---\n\nText.\n`

/** Writes a doc into the repo's tree, at `src/docs/<file>`. */
const repoDoc = async (file: string, source = docFile(path.basename(file, ".md"))) => {
  await mkdir(path.dirname(path.join(dir.docs, file)), { recursive: true })
  await writeFile(path.join(dir.docs, file), source)
}

beforeEach(async () => {
  vi.clearAllMocks()
  dir.cwd = await mkdtemp(path.join(tmpdir(), "export-doc-"))
  dir.docs = path.join(dir.cwd, "src/docs")
  vi.spyOn(process, "cwd").mockReturnValue(dir.cwd)
  find.mockResolvedValue({ docs: [doc] })
  // The docs it sits under.
  await repoDoc("writing.md")
  await repoDoc("writing/media.md")
  await repoDoc("writing/site.md")
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await rm(dir.cwd, { recursive: true, force: true })
})

describe("docs:export", () => {
  it("writes the latest draft with its media as references to files beside it", async () => {
    await mkdir(path.join(dir.cwd, "public/media"), { recursive: true })
    await writeFile(path.join(dir.cwd, "public/media/search.webp"), "local bytes")

    await main("photos")

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true, where: { slug: { equals: "photos" } } }),
    )
    expect(await exported()).toBe(`---
title: Find photos
summary: Search Unsplash.
publishedAt: 2026-10-18
heroImage: photos-hero.webp
heroAlt: The search drawer
---

![](photos-hero.webp)
`)
    expect(await readFile(path.join(dir.docs, "writing/media/photos-hero.webp"), "utf8")).toBe(
      "local bytes",
    )
    expect(destroy).toHaveBeenCalled()
  })

  it("keeps the audience, the updated day, the sidebar title, and a table of contents turned off", async () => {
    await mkdir(path.join(dir.cwd, "public/media"), { recursive: true })
    await writeFile(path.join(dir.cwd, "public/media/search.webp"), "local bytes")
    find.mockResolvedValue({
      docs: [
        {
          ...doc,
          revisedAt: "2026-10-20T00:00:00.000Z",
          navTitle: "Unsplash",
          audience: ["editor"],
          showTableOfContents: false,
          content: {},
        },
      ],
    })
    await main("photos")
    const file = await exported()
    expect(file).toContain("\nnavTitle: Unsplash\n")
    expect(file).toContain("\nrevisedAt: 2026-10-20\n")
    expect(file).toContain("\naudience: [editor]\n")
    expect(file).toContain("\nshowTableOfContents: false\n")
  })

  it("names other files for the doc, and moves a doc whose place changed, keeping its order", async () => {
    await repoDoc(
      "writing/site/photos.md",
      `${docFile("Photos", "heroImage: photos-hero.webp\nheroAlt: Old\norder: 3\n")}\n![Old](photos-old.webp)\n`,
    )
    await writeFile(path.join(dir.docs, "writing/site/photos-hero.webp"), "old")
    await writeFile(path.join(dir.docs, "writing/site/photos-old.webp"), "old")
    // Another doc's picture, whose name starts the same way, stays.
    await writeFile(path.join(dir.docs, "writing/site/photos-gallery-hero.webp"), "theirs")
    const drawer = { ...image, id: 10, filename: "drawer.webp", url: "/drawer.webp" }
    vi.stubGlobal("fetch", async () => new Response("bytes"))
    find.mockResolvedValue({
      docs: [{ ...doc, content: { root: { children: [{ type: "upload", value: drawer }] } } }],
    })
    await main("photos")
    const file = await exported()
    expect(file).toContain("![](photos-drawer.webp)")
    expect(file).toContain("\norder: 3\n")
    expect(await readFile(path.join(dir.docs, "writing/media/photos-drawer.webp"), "utf8")).toBe(
      "bytes",
    )
    for (const gone of ["photos.md", "photos-hero.webp", "photos-old.webp"]) {
      expect(existsSync(path.join(dir.docs, "writing/site", gone)), gone).toBe(false)
    }
    expect(existsSync(path.join(dir.docs, "writing/site/photos-gallery-hero.webp"))).toBe(true)
  })

  it("refuses a doc under one the repo doesn't have, or one with docs under it that moved", async () => {
    find.mockResolvedValue({
      docs: [{ ...doc, breadcrumbs: [{ doc: { slug: "mine" } }, { doc: { slug: "photos" } }] }],
    })
    await expect(main("photos")).rejects.toThrow(/sits under "mine", which isn't in src\/docs\//)

    await repoDoc("writing/site/photos.md")
    await repoDoc("writing/site/photos/more.md")
    find.mockResolvedValue({ docs: [doc] })
    await expect(main("photos")).rejects.toThrow(/move its folder by hand/)
  })

  it("writes a doc under no other, like the home doc, at the top of src/docs/", async () => {
    vi.stubGlobal("fetch", async () => new Response("bytes"))
    find.mockResolvedValue({ docs: [{ ...doc, slug: "home", breadcrumbs: [] }] })
    await main("home")
    expect(await readFile(path.join(dir.docs, "home.md"), "utf8")).toContain("title:")
    expect(existsSync(path.join(dir.docs, "home-hero.webp"))).toBe(true)
  })

  it("downloads media that isn't stored locally", async () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "")
    const fetch = vi.fn(async () => new Response("remote bytes"))
    vi.stubGlobal("fetch", fetch)
    await main("photos")
    expect(fetch).toHaveBeenCalledWith(new URL("http://localhost:8000/api/media/file/search.webp"))
    expect(await readFile(path.join(dir.docs, "writing/media/photos-hero.webp"), "utf8")).toBe(
      "remote bytes",
    )
  })

  it("fails when a download fails", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }))
    await expect(main("photos")).rejects.toThrow(/404/)
    expect(destroy).toHaveBeenCalled()
  })

  it("writes a doc with no hero image without one", async () => {
    vi.stubGlobal("fetch", async () => new Response("bytes"))
    find.mockResolvedValue({ docs: [{ ...doc, heroImage: null }] })
    await main("photos")
    expect(await exported()).not.toContain("hero")
  })

  it.each([
    ["no slug is given", undefined, [doc], /Usage/],
    ["no doc has the slug", "nope", [], /No doc with the slug "nope"/],
    ["the doc has no date", "photos", [{ ...doc, publishedAt: null }], /no published date/],
  ])("fails when %s", async (_, slug, docs, message) => {
    find.mockResolvedValue({ docs })
    await expect(main(slug)).rejects.toThrow(message)
  })
})
