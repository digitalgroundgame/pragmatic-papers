// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MapAsset } from "@/payload-types"

const generateMapImages = vi.fn()
vi.mock("@/blocks/InteractiveMap/feedImage", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateMapImages,
}))

const revalidateForReaders = vi.fn()
vi.mock("@/hooks/revalidateForReaders", () => ({ revalidateForReaders }))

const { regenerateMapImages } = await import("../regenerateMapImages")

const mapBlock = (...assets: (number | { id: number })[]) => ({
  blockType: "interactiveMap",
  maps: assets.map((svgAsset) => ({ svgAsset })),
})
const article = (slug: string, ...blocks: object[]) => ({
  slug,
  content: {
    root: { type: "root", children: blocks.map((fields) => ({ type: "block", fields })) },
  },
})

const find = vi.fn()
const logger = { error: vi.fn() }
const req: { payload: object; context: Record<string, unknown> } = {
  payload: { find, logger },
  context: {},
}

const asset = (svgContent: string): MapAsset => ({
  id: 4,
  svgContent,
  createdAt: "",
  updatedAt: "",
})

const run = (args: { operation?: "create" | "update"; before?: string; after?: string }) => {
  const doc = asset(args.after ?? "<svg>new</svg>")
  return regenerateMapImages({
    doc,
    previousDoc: asset(args.before ?? "<svg>old</svg>"),
    operation: args.operation ?? "update",
    req,
  } as never).then(() => doc)
}

beforeEach(() => {
  find.mockReset()
  generateMapImages.mockReset()
  logger.error.mockReset()
  revalidateForReaders.mockReset()
  req.context = {}
})

describe("regenerateMapImages", () => {
  it("redraws the blocks using the map in every published article, page by page", async () => {
    const uses = mapBlock(4)
    const usesLoaded = mapBlock(7, { id: 4 })
    const another = mapBlock(7)
    find
      .mockResolvedValueOnce({ docs: [article("one", uses, another)], hasNextPage: true })
      .mockResolvedValueOnce({
        docs: [article("two", usesLoaded), article("three")],
        hasNextPage: false,
      })

    const doc = await run({})

    expect(find).toHaveBeenCalledTimes(2)
    expect(find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "articles",
        where: { _status: { equals: "published" } },
        page: 2,
        req,
      }),
    )
    // The asset being saved is handed over: its new SVG isn't committed yet.
    expect(generateMapImages).toHaveBeenNthCalledWith(1, { blocks: [uses], req, assets: [doc] })
    expect(generateMapImages).toHaveBeenNthCalledWith(2, {
      blocks: [usesLoaded],
      req,
      assets: [doc],
    })
    // Their Substack feeds are cached, so they're revalidated to name the new pictures.
    expect(revalidateForReaders).toHaveBeenCalledWith(logger, "map 4", {
      paths: ["/articles/substack.xml", "/articles/one/substack.xml", "/articles/two/substack.xml"],
    })
  })

  it("revalidates nothing when no article uses the map", async () => {
    find.mockResolvedValueOnce({ docs: [article("one", mapBlock(7))], hasNextPage: false })
    await run({})
    expect(revalidateForReaders).not.toHaveBeenCalled()
  })

  it("leaves revalidating to the caller that asked it not to", async () => {
    req.context = { disableRevalidate: true }
    find.mockResolvedValueOnce({ docs: [article("one", mapBlock(4))], hasNextPage: false })
    await run({})
    expect(generateMapImages).toHaveBeenCalled()
    expect(revalidateForReaders).not.toHaveBeenCalled()
  })

  it.each([
    ["a new map, which no article uses yet", { operation: "create" as const }],
    ["a save that left the SVG as it was", { before: "<svg/>", after: "<svg/>" }],
  ])("does nothing for %s", async (_label, args) => {
    await run(args)
    expect(find).not.toHaveBeenCalled()
    expect(revalidateForReaders).not.toHaveBeenCalled()
  })

  it("logs a failure instead of failing the save", async () => {
    const failure = new Error("no connection")
    find.mockRejectedValue(failure)

    await expect(run({})).resolves.toMatchObject({ id: 4 })
    expect(logger.error).toHaveBeenCalledWith({
      err: failure,
      msg: "Could not render the images of the articles using map 4",
    })
  })
})
