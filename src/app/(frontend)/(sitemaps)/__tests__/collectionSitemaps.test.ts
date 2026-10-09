// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const find = vi.fn()

vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: vi.fn(async () => ({ find })) }))
// Straight through, so each sitemap reads the `find` fixture it was given.
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))

const { GET: pagesRoute } = await import("../pages-sitemap.xml/route")
const { default: articlesSitemap } = await import("../../articles/sitemap")
const { GET: newsSitemap } = await import("../../articles/news-sitemap.xml/route")
const { default: volumesSitemap } = await import("../../volumes/sitemap")

const SITE_URL = "https://pragmaticpapers.com"
const UPDATED_AT = "2026-09-01T12:00:00.000Z"
const PUBLISHED_AT = "2026-08-30T09:00:00.000Z"

const withDocs = (docs: Record<string, unknown>[]) => find.mockResolvedValue({ docs })

const renderXml = async (GET: () => Promise<Response>) => {
  const res = await GET()
  expect(res.headers.get("Content-Type")).toContain("xml")
  return res.text()
}

const locs = (xml: string) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => loc)

const routes = [
  {
    name: "pages",
    collection: "pages",
    list: async () => {
      const xml = await renderXml(pagesRoute)
      const dates = [...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(([, date]) => date)
      return locs(xml).map((loc, i) => [loc, dates[i]])
    },
  },
  {
    name: "articles",
    collection: "articles",
    list: async () => (await articlesSitemap()).map((e) => [e.url, e.lastModified]),
  },
  {
    name: "volumes",
    collection: "volumes",
    list: async () => (await volumesSitemap()).map((e) => [e.url, e.lastModified]),
  },
] as const

beforeEach(() => {
  vi.stubEnv("SERVER_URL", SITE_URL)
  find.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("/pages-sitemap.xml", () => {
  it("puts the home page at the site root and every other page at its slug", async () => {
    withDocs([
      { slug: "home", updatedAt: UPDATED_AT },
      { slug: "about", updatedAt: UPDATED_AT },
    ])

    expect(locs(await renderXml(pagesRoute))).toEqual([SITE_URL, `${SITE_URL}/about`])
  })

  it("leaves no trailing slash on the root when SERVER_URL has one", async () => {
    vi.stubEnv("SERVER_URL", `${SITE_URL}/`)
    withDocs([{ slug: "home", updatedAt: UPDATED_AT }])

    expect(locs(await renderXml(pagesRoute))).toEqual([SITE_URL])
  })
})

describe("/articles/sitemap.xml", () => {
  // Only pages own the root: an article slugged `home` stays under /articles.
  it("keeps an article slugged home under /articles", async () => {
    withDocs([{ slug: "home", updatedAt: UPDATED_AT }])

    expect((await articlesSitemap()).map((e) => e.url)).toEqual([`${SITE_URL}/articles/home`])
  })
})

describe("/articles/news-sitemap.xml", () => {
  it("asks only for articles published in the last two days, newest first", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-03T00:00:00.000Z"), toFake: ["Date"] })
    try {
      withDocs([])

      await renderXml(newsSitemap)

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: "articles",
          overrideAccess: false,
          draft: false,
          sort: "-publishedAt",
          where: {
            _status: { equals: "published" },
            publishedAt: { greater_than_equal: "2026-10-01T00:00:00.000Z" },
          },
        }),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("adds a Google News entry with the title, publication and publish date", async () => {
    withDocs([
      {
        slug: "the-case-for-reform",
        title: "The Case for Reform",
        updatedAt: UPDATED_AT,
        publishedAt: PUBLISHED_AT,
      },
    ])

    const xml = await renderXml(newsSitemap)

    expect(locs(xml)).toEqual([`${SITE_URL}/articles/the-case-for-reform`])
    expect(xml).toContain("<news:title>The Case for Reform</news:title>")
    expect(xml).toContain("<news:name>The Pragmatic Papers</news:name>")
    expect(xml).toContain("<news:language>en</news:language>")
    // next-sitemap writes the offset out (`+00:00`) rather than `Z`.
    expect(xml).toContain(
      "<news:publication_date>2026-08-30T09:00:00.000+00:00</news:publication_date>",
    )
  })

  it("skips articles without a slug or a publish date", async () => {
    withDocs([
      { slug: "", title: "No slug", publishedAt: PUBLISHED_AT },
      { slug: "undated", title: "Undated" },
      { slug: "kept", title: "Kept", publishedAt: PUBLISHED_AT },
    ])

    expect(locs(await renderXml(newsSitemap))).toEqual([`${SITE_URL}/articles/kept`])
  })
})

describe("/volumes/sitemap.xml", () => {
  it("lists each volume under /volumes", async () => {
    withDocs([
      { slug: "1", updatedAt: UPDATED_AT },
      { slug: "2", updatedAt: UPDATED_AT },
    ])

    expect((await volumesSitemap()).map((e) => e.url)).toEqual([
      `${SITE_URL}/volumes/1`,
      `${SITE_URL}/volumes/2`,
    ])
  })
})

describe.each(routes)("the $name sitemap", ({ collection, list }) => {
  it("asks only for published documents, as an anonymous reader", async () => {
    withDocs([])

    await list()

    expect(find).toHaveBeenCalledOnce()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection,
        overrideAccess: false,
        draft: false,
        where: { _status: { equals: "published" } },
      }),
    )
  })

  it("skips documents without a slug", async () => {
    withDocs([
      { slug: null, title: "No slug", updatedAt: UPDATED_AT },
      { slug: "", title: "Empty slug", updatedAt: UPDATED_AT },
      { slug: "kept", title: "Kept", updatedAt: UPDATED_AT, publishedAt: PUBLISHED_AT },
    ])

    const entries = await list()

    expect(entries).toHaveLength(1)
    expect(entries[0]?.[0]).toMatch(/\/kept$/)
  })

  it("uses updatedAt for the last-modified date, and the current time when it's missing", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-03T00:00:00.000Z"), toFake: ["Date"] })
    try {
      withDocs([
        { slug: "dated", title: "Dated", updatedAt: UPDATED_AT, publishedAt: PUBLISHED_AT },
        { slug: "undated", title: "Undated", publishedAt: PUBLISHED_AT },
      ])

      expect((await list()).map(([, date]) => date)).toEqual([
        UPDATED_AT,
        "2026-10-03T00:00:00.000Z",
      ])
    } finally {
      vi.useRealTimers()
    }
  })
})
