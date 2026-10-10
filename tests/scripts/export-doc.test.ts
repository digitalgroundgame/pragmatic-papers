import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
vi.mock("@/plugins/docs/syncDocs", () => ({
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
  section: "media",
  audience: [],
  showTableOfContents: true,
  content: { root: { children: [{ type: "upload", value: image }] } },
}

const exported = async (slug = "photos", section = "media") =>
  readFile(path.join(dir.docs, section, `${slug}.md`), "utf8")

beforeEach(async () => {
  vi.clearAllMocks()
  dir.cwd = await mkdtemp(path.join(tmpdir(), "export-doc-"))
  dir.docs = path.join(dir.cwd, "src/docs")
  vi.spyOn(process, "cwd").mockReturnValue(dir.cwd)
  find.mockResolvedValue({ docs: [doc] })
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
    expect(await readFile(path.join(dir.docs, "media/photos-hero.webp"), "utf8")).toBe(
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

  it("names other files for the doc, and moves a doc whose section changed", async () => {
    await mkdir(path.join(dir.docs, "site"), { recursive: true })
    await writeFile(path.join(dir.docs, "site/photos.md"), "old")
    const drawer = { ...image, id: 10, filename: "drawer.webp", url: "/drawer.webp" }
    vi.stubGlobal("fetch", async () => new Response("bytes"))
    find.mockResolvedValue({
      docs: [{ ...doc, content: { root: { children: [{ type: "upload", value: drawer }] } } }],
    })
    await main("photos")
    expect(await exported()).toContain("![](photos-drawer.webp)")
    expect(await readFile(path.join(dir.docs, "media/photos-drawer.webp"), "utf8")).toBe("bytes")
    expect(existsSync(path.join(dir.docs, "site/photos.md"))).toBe(false)
  })

  it("downloads media that isn't stored locally", async () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "")
    const fetch = vi.fn(async () => new Response("remote bytes"))
    vi.stubGlobal("fetch", fetch)
    await main("photos")
    expect(fetch).toHaveBeenCalledWith(new URL("http://localhost:8000/api/media/file/search.webp"))
    expect(await readFile(path.join(dir.docs, "media/photos-hero.webp"), "utf8")).toBe(
      "remote bytes",
    )
  })

  it("fails when a download fails", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }))
    await expect(main("photos")).rejects.toThrow(/404/)
    expect(destroy).toHaveBeenCalled()
  })

  it.each([
    ["no slug is given", undefined, [doc], /Usage/],
    ["no doc has the slug", "nope", [], /No doc with the slug "nope"/],
    ["the doc has no date", "photos", [{ ...doc, publishedAt: null }], /no published date/],
    ["the doc has no hero image", "photos", [{ ...doc, heroImage: null }], /no hero image/],
  ])("fails when %s", async (_, slug, docs, message) => {
    find.mockResolvedValue({ docs })
    await expect(main(slug)).rejects.toThrow(message)
  })
})
