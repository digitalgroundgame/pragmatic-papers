// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateForReaders, collectMediaReferences } = vi.hoisted(() => ({
  revalidateForReaders: vi.fn(),
  collectMediaReferences: vi.fn(),
}))
vi.mock("@/hooks/revalidateForReaders", () => ({ revalidateForReaders }))
vi.mock("../../references/collectMediaReferences", () => ({ collectMediaReferences }))
vi.mock("@/plugins/docs/revalidateDoc", () => ({ DOCS_CACHE_TAG: "docs" }))

const { revalidateMediaUsers } = await import("../revalidateMediaUsers")

const find = vi.fn()
const logger = { info: vi.fn() }
const media = { id: 9, alt: "A field", caption: null, filename: "field.webp" }
const save = (doc: object, previousDoc: object = media, context = {}, operation = "update") =>
  revalidateMediaUsers({
    doc,
    previousDoc,
    operation,
    req: { payload: { find, logger }, context },
  } as never)

const ref = (collection: string, docId: number, docSlug?: string) => ({
  collection,
  docId,
  docSlug,
  docTitle: "t",
  field: "f",
})

beforeEach(() => {
  vi.clearAllMocks()
  collectMediaReferences.mockResolvedValue([])
  find.mockResolvedValue({ docs: [] })
})

describe("revalidateMediaUsers", () => {
  it("revalidates every page that shows a picture whose alt text changed", async () => {
    collectMediaReferences.mockResolvedValue([
      ref("articles", 1, "the-case"),
      ref("pages", 2, "about"),
      ref("docs", 3, "guide"),
      ref("users", 7),
    ])
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === "volumes" ? [{ id: 4, slug: "vol-1" }] : [{ id: 5, slug: "by-jane" }],
    }))

    await save({ ...media, alt: "A wheat field" })

    expect(collectMediaReferences).toHaveBeenCalledWith(expect.anything(), 9)
    expect(revalidateForReaders).toHaveBeenCalledExactlyOnceWith(logger, "media 9", {
      paths: ["/articles/the-case", "/articles/by-jane", "/volumes/vol-1"],
      purgeOnly: ["/about", "/docs/guide"],
      tags: ["docs"],
      shared: true,
    })
  })

  it("revalidates the prerendered home page when it alone shows the picture", async () => {
    collectMediaReferences.mockResolvedValue([ref("pages", 1, "home")])

    await save({ ...media, alt: "A wheat field" })

    expect(revalidateForReaders).toHaveBeenCalledExactlyOnceWith(logger, "media 9", {
      paths: ["/"],
      purgeOnly: [],
      tags: [],
      shared: true,
    })
  })

  it("revalidates the volumes a contributor's articles are in when their picture changes", async () => {
    collectMediaReferences.mockResolvedValue([ref("users", 7)])
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === "volumes" ? [{ id: 4, slug: "vol-1" }] : [{ id: 5, slug: "by-jane" }],
    }))

    await save({ ...media, alt: "A portrait" })

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "volumes", where: { "articles.id": { in: [5] } } }),
    )
    expect(revalidateForReaders).toHaveBeenCalledWith(
      logger,
      "media 9",
      expect.objectContaining({ paths: ["/articles/by-jane", "/volumes/vol-1"] }),
    )
  })

  it("skips a save that changes nothing readers see, without reading content", async () => {
    await save({ ...media, narrator: 3 })
    expect(collectMediaReferences).not.toHaveBeenCalled()
    expect(revalidateForReaders).not.toHaveBeenCalled()
  })

  it("skips a picture nothing published uses", async () => {
    await save({ ...media, alt: "New" })
    expect(revalidateForReaders).not.toHaveBeenCalled()
  })

  it("skips uploads and saves with revalidation disabled", async () => {
    await save({ ...media, alt: "New" }, undefined, {}, "create")
    await save({ ...media, alt: "New" }, media, { disableRevalidate: true })
    expect(collectMediaReferences).not.toHaveBeenCalled()
  })
})
