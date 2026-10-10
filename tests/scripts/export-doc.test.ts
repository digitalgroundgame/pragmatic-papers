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
  audience: [],
  showTableOfContents: true,
  content: { root: { children: [{ type: "upload", value: image }] } },
}

const exported = async (slug = "photos") =>
  JSON.parse(await readFile(path.join(dir.docs, slug, "doc.json"), "utf8"))

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
    expect(await exported()).toEqual({
      title: "Find photos",
      summary: "Search Unsplash.",
      publishedAt: "2026-10-18",
      heroImage: { $media: "search.webp", alt: "The search drawer" },
      content: {
        root: {
          children: [
            { type: "upload", value: { $media: "search.webp", alt: "The search drawer" } },
          ],
        },
      },
    })
    expect(await readFile(path.join(dir.docs, "photos/search.webp"), "utf8")).toBe("local bytes")
    expect(destroy).toHaveBeenCalled()
  })

  it("keeps the audience, and a table of contents turned off", async () => {
    await mkdir(path.join(dir.cwd, "public/media"), { recursive: true })
    await writeFile(path.join(dir.cwd, "public/media/search.webp"), "local bytes")
    find.mockResolvedValue({
      docs: [{ ...doc, audience: ["editor"], showTableOfContents: false, content: {} }],
    })
    await main("photos")
    expect(await exported()).toMatchObject({ audience: ["editor"], showTableOfContents: false })
  })

  it("downloads media that isn't stored locally", async () => {
    vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "")
    const fetch = vi.fn(async () => new Response("remote bytes"))
    vi.stubGlobal("fetch", fetch)
    await main("photos")
    expect(fetch).toHaveBeenCalledWith(new URL("http://localhost:8000/api/media/file/search.webp"))
    expect(await readFile(path.join(dir.docs, "photos/search.webp"), "utf8")).toBe("remote bytes")
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
