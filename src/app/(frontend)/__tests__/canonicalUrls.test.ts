import type { Metadata } from "next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authors, topics } from "@/stories/fixtures/docs"

const { queries, find } = vi.hoisted(() => ({
  find: vi.fn(),
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
vi.mock("payload", () => ({ getPayload: async () => ({ find }) }))
vi.mock("@payloadcms/db-postgres", () => ({ sql: vi.fn() }))
vi.mock("@/data/queries", () => queries)
vi.mock("@/data/globals", () => ({ getGlobal: async () => ({ socials: [] }) }))
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
  find.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 2, page: 1 })
  queries.queryPageBySlug.mockResolvedValue({ slug: "about", title: "About", meta: {}, layout: [] })
  queries.queryUserBySlug.mockResolvedValue(author)
  queries.queryTopicBySlug.mockResolvedValue(topic)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

// Every page of a `?p=` listing is its own canonical: naming page 1 on page 2 would tell
// Google to drop the articles that are only on page 2.
describe("canonical URLs", () => {
  it("puts the home page at the site root, and keeps a later page of its volume list", async () => {
    const { generateMetadata } = await import("../[slug]/page")
    queries.queryPageBySlug.mockResolvedValue({
      slug: "home",
      meta: {},
      layout: [{ blockType: "content" }, { blockType: "volumeView" }],
    })

    expect(urls(await generateMetadata(home()))).toEqual(both(`${SITE}/`))
    expect(urls(await generateMetadata(home("2")))).toEqual(both(`${SITE}/?p=2`))
  })

  it("ignores ?p= on a page with nothing to paginate", async () => {
    const { generateMetadata } = await import("../[slug]/page")

    expect(urls(await generateMetadata(page("about", "3")))).toEqual(both(`${SITE}/about`))
  })

  it("names a topic's later pages, and drops a page number of 1", async () => {
    const { generateMetadata } = await import("../topics/[slug]/page")
    const path = `${SITE}/topics/${topic.slug}`

    expect(urls(await generateMetadata(page(topic.slug!, "1")))).toEqual(both(path))
    expect(urls(await generateMetadata(page(topic.slug!, "4")))).toEqual(both(`${path}?p=4`))
  })

  it("names an author's later pages, and ignores a page number the listing ignores", async () => {
    const { generateMetadata } = await import("../contributors/[slug]/page")
    const path = `${SITE}/contributors/${author.slug}`

    expect(urls(await generateMetadata(page(author.slug!, "abc")))).toEqual(both(path))
    expect(urls(await generateMetadata(page(author.slug!, "2")))).toEqual(both(`${path}?p=2`))
  })

  it("gives the topics index a canonical URL", async () => {
    const { generateMetadata } = await import("../topics/page")

    expect(urls(await generateMetadata(listing()))).toEqual(both(`${SITE}/topics`))
    expect(urls(await generateMetadata(listing("2")))).toEqual(both(`${SITE}/topics?p=2`))
  })

  it("gives the authors index a canonical URL", async () => {
    const { generateMetadata } = await import("../contributors/page")

    expect(urls(await generateMetadata(listing()))).toEqual(both(`${SITE}/contributors`))
    expect(urls(await generateMetadata(listing("3")))).toEqual(both(`${SITE}/contributors?p=3`))
  })
})

// Past the last page there's nothing to list, so there's no page to name as canonical.
describe("pages past the last one", () => {
  const is404 = { digest: expect.stringContaining("404") }

  it("are not found on the topics index", async () => {
    const { default: TopicsPage } = await import("../topics/page")

    await expect(TopicsPage(listing("3"))).rejects.toMatchObject(is404)
    await expect(TopicsPage(listing("2"))).resolves.toBeDefined()
  })

  it("are not found on a topic's article list", async () => {
    const { default: TopicPage } = await import("../topics/[slug]/page")

    await expect(TopicPage(page(topic.slug!, "3"))).rejects.toMatchObject(is404)
  })

  it("are not found on an author's article list", async () => {
    const { default: AuthorPage } = await import("../contributors/[slug]/page")

    await expect(AuthorPage(page(author.slug!, "3"))).rejects.toMatchObject(is404)
  })

  it("leave an empty first page alone, so a new topic shows its empty state", async () => {
    const { default: TopicPage } = await import("../topics/[slug]/page")
    find.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, page: 1 })

    await expect(TopicPage(page(topic.slug!))).resolves.toBeDefined()
  })
})

describe("search results", () => {
  it("keeps results pages out of the index, but lets crawlers follow their links", async () => {
    const { metadata } = await import("../search/page")

    expect(metadata.robots).toEqual({ index: false, follow: true })
  })
})
