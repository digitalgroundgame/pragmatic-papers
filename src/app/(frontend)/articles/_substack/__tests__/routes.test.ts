// @vitest-environment node
import type { Article } from "@/payload-types"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("../queries", () => ({
  querySyndicatedArticles: vi.fn(),
  querySyndicatedArticleBySlug: vi.fn(),
}))

beforeAll(() => {
  process.env.NEXT_PUBLIC_SERVER_URL = "https://example.org"
})

const { querySyndicatedArticles, querySyndicatedArticleBySlug } = await import("../queries")
const feedRoute = await import("../../substack.xml/route")
const articleRoute = await import("../../[slug]/substack.xml/route")

const article = (slug: string, title = `Title ${slug}`): Article =>
  ({
    id: slug.length,
    title,
    slug,
    _status: "published",
    publishedAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    createdAt: "2026-09-01T12:00:00.000Z",
    content: {
      root: {
        type: "root",
        children: [
          { type: "paragraph", version: 1, children: [{ type: "text", text: title, version: 1 }] },
        ],
        direction: null,
        format: "",
        indent: 0,
        version: 1,
      },
    },
  }) as Article

const params = (slug: string) => ({ params: Promise.resolve({ slug }) })
const items = (xml: string) => xml.match(/<item>/g)?.length ?? 0

afterEach(() => {
  vi.resetAllMocks()
})

describe("GET /articles/substack.xml", () => {
  it("serves every syndicated article as an RSS feed", async () => {
    vi.mocked(querySyndicatedArticles).mockResolvedValue([article("one"), article("two")])

    const response = await feedRoute.GET()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8")
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=")
    expect(items(xml)).toBe(2)
    expect(xml).toContain("<link>https://example.org/articles/one</link>")
    expect(xml).toContain("<link>https://example.org/articles/two</link>")
  })

  it("serves an empty feed when nothing is syndicated", async () => {
    vi.mocked(querySyndicatedArticles).mockResolvedValue([])

    const response = await feedRoute.GET()

    expect(response.status).toBe(200)
    expect(items(await response.text())).toBe(0)
  })

  it("is statically cached", () => {
    expect(feedRoute.dynamic).toBe("force-static")
  })
})

describe("GET /articles/[slug]/substack.xml", () => {
  it("serves a feed holding only the requested article", async () => {
    vi.mocked(querySyndicatedArticleBySlug).mockResolvedValue(article("one"))

    const response = await articleRoute.GET(new Request("https://example.org"), params("one"))
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8")
    expect(items(xml)).toBe(1)
    expect(xml).toContain("<link>https://example.org/articles/one</link>")
    expect(querySyndicatedArticleBySlug).toHaveBeenCalledWith("one")
  })

  it("decodes an encoded slug before looking it up", async () => {
    vi.mocked(querySyndicatedArticleBySlug).mockResolvedValue(null)

    await articleRoute.GET(new Request("https://example.org"), params("caf%C3%A9"))

    expect(querySyndicatedArticleBySlug).toHaveBeenCalledWith("café")
  })

  it("returns 404 when the article isn't published and syndicated", async () => {
    vi.mocked(querySyndicatedArticleBySlug).mockResolvedValue(null)

    const response = await articleRoute.GET(new Request("https://example.org"), params("draft"))

    expect(response.status).toBe(404)
  })

  it("prebuilds a page for every syndicated article", async () => {
    vi.mocked(querySyndicatedArticles).mockResolvedValue([article("one"), article("two")])

    await expect(articleRoute.generateStaticParams()).resolves.toEqual([
      { slug: "one" },
      { slug: "two" },
    ])
    expect(articleRoute.dynamic).toBe("force-static")
  })
})
