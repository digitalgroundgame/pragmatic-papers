// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const find = vi.fn()

vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock("@payload-config", () => ({ default: Promise.resolve({}) }))
// Straight through, so each GET reads the `find` fixture it was given.
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))

const { GET: pagesSitemap } = await import("../pages-sitemap.xml/route")
const { GET: articlesSitemap } = await import("../articles-sitemap.xml/route")
const { GET: volumesSitemap } = await import("../volumes-sitemap.xml/route")

const SITE_URL = "https://pragmaticpapers.com"
const UPDATED_AT = "2026-09-01T12:00:00.000Z"
const PUBLISHED_AT = "2026-08-30T09:00:00.000Z"

const withDocs = (docs: Record<string, unknown>[]) => find.mockResolvedValue({ docs })

const render = async (GET: () => Promise<Response>) => {
  const res = await GET()
  expect(res.headers.get("Content-Type")).toContain("xml")
  return res.text()
}

const locs = (xml: string) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => loc)
const lastmods = (xml: string) =>
  [...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(([, lastmod]) => lastmod)

const routes = [
  { name: "pages", collection: "pages", GET: pagesSitemap },
  { name: "articles", collection: "articles", GET: articlesSitemap },
  { name: "volumes", collection: "volumes", GET: volumesSitemap },
] as const

beforeEach(() => {
  vi.stubEnv("SERVER_URL", SITE_URL)
  find.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("GET /pages-sitemap.xml", () => {
  it("puts the home page at the site root and every other page at its slug", async () => {
    withDocs([
      { slug: "home", updatedAt: UPDATED_AT },
      { slug: "about", updatedAt: UPDATED_AT },
    ])

    expect(locs(await render(pagesSitemap))).toEqual([SITE_URL, `${SITE_URL}/about`])
  })

  it("leaves no trailing slash on the root when SERVER_URL has one", async () => {
    vi.stubEnv("SERVER_URL", `${SITE_URL}/`)
    withDocs([{ slug: "home", updatedAt: UPDATED_AT }])

    expect(locs(await render(pagesSitemap))).toEqual([SITE_URL])
  })
})

describe("GET /articles-sitemap.xml", () => {
  // #964: an article slugged `home` used to be sent to the site root, the bug #961
  // found in getLinkFieldUrl. Only pages own the root.
  it("keeps an article slugged home under /articles", async () => {
    withDocs([{ slug: "home", title: "Home", updatedAt: UPDATED_AT, publishedAt: PUBLISHED_AT }])

    expect(locs(await render(articlesSitemap))).toEqual([`${SITE_URL}/articles/home`])
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

    const xml = await render(articlesSitemap)

    expect(locs(xml)).toEqual([`${SITE_URL}/articles/the-case-for-reform`])
    expect(xml).toContain("<news:title>The Case for Reform</news:title>")
    expect(xml).toContain("<news:name>The Pragmatic Papers</news:name>")
    expect(xml).toContain("<news:language>en</news:language>")
    // next-sitemap writes the offset out (`+00:00`) rather than `Z`.
    expect(xml).toContain(
      "<news:publication_date>2026-08-30T09:00:00.000+00:00</news:publication_date>",
    )
  })
})

describe("GET /volumes-sitemap.xml", () => {
  it("lists each volume under /volumes", async () => {
    withDocs([
      { slug: "1", updatedAt: UPDATED_AT },
      { slug: "2", updatedAt: UPDATED_AT },
    ])

    expect(locs(await render(volumesSitemap))).toEqual([
      `${SITE_URL}/volumes/1`,
      `${SITE_URL}/volumes/2`,
    ])
  })
})

describe.each(routes)("GET /$name-sitemap.xml", ({ collection, GET }) => {
  it("asks only for published documents, as an anonymous reader", async () => {
    withDocs([])

    await render(GET)

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

    const xml = await render(GET)

    expect(locs(xml)).toHaveLength(1)
    expect(locs(xml)[0]).toMatch(/\/kept$/)
  })

  it("uses updatedAt for lastmod, and the current time when it's missing", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-03T00:00:00.000Z"), toFake: ["Date"] })
    try {
      withDocs([
        { slug: "dated", title: "Dated", updatedAt: UPDATED_AT, publishedAt: PUBLISHED_AT },
        { slug: "undated", title: "Undated", publishedAt: PUBLISHED_AT },
      ])

      expect(lastmods(await render(GET))).toEqual([UPDATED_AT, "2026-10-03T00:00:00.000Z"])
    } finally {
      vi.useRealTimers()
    }
  })
})
