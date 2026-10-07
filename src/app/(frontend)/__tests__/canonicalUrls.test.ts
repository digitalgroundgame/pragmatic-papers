import type { Metadata } from "next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authors, topics } from "@/stories/fixtures/docs"

const { queries } = vi.hoisted(() => ({
  queries: {
    queryPageBySlug: vi.fn(),
    queryUserBySlug: vi.fn(),
    queryTopicBySlug: vi.fn(),
    queryVolumesForArticles: vi.fn(async () => []),
  },
}))

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: async () => ({ find: vi.fn() }) }))
vi.mock("@payloadcms/db-postgres", () => ({ sql: vi.fn() }))
vi.mock("@/utilities/queries", () => queries)
vi.mock("@/utilities/getGlobals", () => ({ getCachedGlobal: () => async () => ({ socials: [] }) }))
vi.mock("@/endpoints/seed/home-static", () => ({ homeStatic: null }))

const SITE = "https://pragmaticpapers.com"

const author = authors[0]!
const topic = topics[0]!

/** The canonical URL a page's metadata names, and the og:url that must agree with it. */
const urls = (meta: Metadata) => ({
  canonical: meta.alternates?.canonical,
  og: (meta.openGraph as { url?: string } | undefined)?.url,
})

const both = (url: string) => ({ canonical: url, og: url })

const listing = (p?: string) => ({ searchParams: Promise.resolve(p === undefined ? {} : { p }) })
const page = (slug: string, p?: string) => ({ params: Promise.resolve({ slug }), ...listing(p) })
const home = (p?: string) => ({ params: Promise.resolve({}), ...listing(p) })

beforeEach(() => {
  vi.stubEnv("SERVER_URL", SITE)
  queries.queryPageBySlug.mockResolvedValue({ slug: "about", title: "About", meta: {} })
  queries.queryUserBySlug.mockResolvedValue(author)
  queries.queryTopicBySlug.mockResolvedValue(topic)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

// Every page of a `?p=` listing is its own canonical: naming page 1 on page 2 would tell
// Google to drop the articles that are only on page 2.
describe("canonical URLs", () => {
  it("puts the home page at the site root, and keeps a later page's number", async () => {
    const { generateMetadata } = await import("../[slug]/page")

    expect(urls(await generateMetadata(home()))).toEqual(both(`${SITE}/`))
    expect(urls(await generateMetadata(home("2")))).toEqual(both(`${SITE}/?p=2`))
    expect(urls(await generateMetadata(page("about", "3")))).toEqual(both(`${SITE}/about?p=3`))
  })

  it("names a topic's later pages, and drops a page number of 1", async () => {
    const { generateMetadata } = await import("../topics/[slug]/page")
    const path = `${SITE}/topics/${topic.slug}`

    expect(urls(await generateMetadata(page(topic.slug!, "1")))).toEqual(both(path))
    expect(urls(await generateMetadata(page(topic.slug!, "4")))).toEqual(both(`${path}?p=4`))
  })

  it("names an author's later pages, and ignores a page number the listing ignores", async () => {
    const { generateMetadata } = await import("../authors/[slug]/page")
    const path = `${SITE}/authors/${author.slug}`

    expect(urls(await generateMetadata(page(author.slug!, "abc")))).toEqual(both(path))
    expect(urls(await generateMetadata(page(author.slug!, "2")))).toEqual(both(`${path}?p=2`))
  })

  it("gives the topics index a canonical URL", async () => {
    const { generateMetadata } = await import("../topics/page")

    expect(urls(await generateMetadata(listing()))).toEqual(both(`${SITE}/topics`))
    expect(urls(await generateMetadata(listing("2")))).toEqual(both(`${SITE}/topics?p=2`))
  })

  it("gives the authors index a canonical URL", async () => {
    const { generateMetadata } = await import("../authors/page")

    expect(urls(await generateMetadata(listing()))).toEqual(both(`${SITE}/authors`))
    expect(urls(await generateMetadata(listing("3")))).toEqual(both(`${SITE}/authors?p=3`))
  })
})

describe("search results", () => {
  it("keeps results pages out of the index, but lets crawlers follow their links", async () => {
    const { metadata } = await import("../search/page")

    expect(metadata.robots).toEqual({ index: false, follow: true })
  })
})
