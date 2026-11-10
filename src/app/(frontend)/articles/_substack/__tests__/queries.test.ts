// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

const find = vi.fn()
const logger = { error: vi.fn() }
vi.mock("@/data/payload", () => ({
  getPayloadClient: vi.fn(async () => ({ find, logger })),
}))

const { querySyndicatedArticleBySlug, querySyndicatedArticles } = await import("../queries")

const syndicated = {
  and: [{ _status: { equals: "published" } }, { syndicateToSubstack: { equals: true } }],
}

const notImported = {
  or: [{ substackUrl: { exists: false } }, { substackUrl: { equals: "" } }],
}

afterEach(() => {
  find.mockReset()
  logger.error.mockReset()
})

const SVG = `<svg viewBox="0 0 10 10"><g><path id="A" d="M0 0H10V10H0Z"/></g></svg>`

/** An article whose content is one interactive map, loaded with its asset. */
const articleWithMap = (slug: string) => ({
  slug,
  content: {
    root: {
      type: "root",
      children: [
        {
          type: "block",
          fields: {
            blockType: "interactiveMap",
            maps: [{ svgAsset: { id: 1, svgContent: SVG } }],
          },
        },
      ],
    },
  },
})

const mapOf = (article: ReturnType<typeof articleWithMap> | null) =>
  article?.content.root.children[0]?.fields as { feedImage?: unknown } | undefined

/** The first `find` answers with articles; the next, the lookup of their maps' pictures. */
const findArticlesThenImages = (articles: object[], images: object[] | Error) => {
  find.mockResolvedValueOnce({ docs: articles })
  if (images instanceof Error) find.mockRejectedValueOnce(images)
  else find.mockResolvedValueOnce({ docs: images })
}

// The integration test (tests/integration/substackFeed.test.ts) checks what these select
// against a real database; these pin the query itself, so it can't silently widen to
// drafts or articles nobody opted in.
describe("querySyndicatedArticles", () => {
  it("asks for every published, syndicated article not yet on Substack, newest first, as the public", async () => {
    find.mockResolvedValue({ docs: [{ slug: "one" }] })

    await expect(querySyndicatedArticles()).resolves.toEqual([{ slug: "one" }])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        draft: false,
        limit: 0,
        overrideAccess: false,
        where: { and: [syndicated, notImported] },
        sort: "-publishedAt",
      }),
    )
  })
})

describe("map pictures", () => {
  it("attaches each map's stored picture, found by the name its hash gives it", async () => {
    findArticlesThenImages([articleWithMap("one")], [])
    const [article] = await querySyndicatedArticles()
    const { where } = find.mock.calls[1]![0]
    const name = where.or[0].filename.contains as string
    expect(find.mock.calls[1]![0]).toMatchObject({ collection: "media" })
    expect(name).toMatch(/^interactive-map-[0-9a-f]{16}$/)
    expect(mapOf(article as never)).toHaveProperty("feedImage", null)

    const picture = { id: 3, filename: `${name}.webp`, url: `/media/${name}.webp` }
    findArticlesThenImages([articleWithMap("one")], [picture])
    const found = await querySyndicatedArticleBySlug("with-picture")
    expect(mapOf(found as never)).toHaveProperty("feedImage", picture)
  })

  it("still returns the articles when the lookup fails, and logs it", async () => {
    const failure = new Error("database is down")
    findArticlesThenImages([articleWithMap("two")], failure)

    await expect(querySyndicatedArticleBySlug("failing")).resolves.toMatchObject({ slug: "two" })
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: failure }))
  })
})

describe("querySyndicatedArticleBySlug", () => {
  it("adds the slug to the same filter", async () => {
    find.mockResolvedValue({ docs: [{ slug: "one" }] })

    await expect(querySyndicatedArticleBySlug("one")).resolves.toEqual({ slug: "one" })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        draft: false,
        overrideAccess: false,
        limit: 1,
        where: { and: [syndicated, { slug: { equals: "one" } }] },
      }),
    )
  })

  it("returns null when nothing matches", async () => {
    find.mockResolvedValue({ docs: [] })

    await expect(querySyndicatedArticleBySlug("missing")).resolves.toBeNull()
  })
})
