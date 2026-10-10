import { cleanup, render, screen, within } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authors, topics, volumes } from "@/stories/fixtures/docs"

const { queries, find, jsonLd } = vi.hoisted(() => ({
  queries: {
    queryUserBySlug: vi.fn(),
    queryTopicBySlug: vi.fn(),
    queryVolumeBySlug: vi.fn(),
    queryVolumesForArticles: vi.fn(async () => []),
  },
  find: vi.fn(),
  jsonLd: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: async () => ({ find }) }))
vi.mock("@/data/queries", () => queries)
vi.mock("@/components/PayloadRedirects", () => ({ PayloadRedirects: () => null }))
vi.mock("@/components/LivePreviewListener", () => ({ LivePreviewListener: () => null }))
vi.mock("@/components/JsonLd", () => ({
  JsonLd: ({ data }: { data: unknown }) => {
    jsonLd(data)
    return null
  },
}))

interface Crumbs {
  "@type": string
  itemListElement: { name: string; item: string }[]
}

const args = (slug: string) => ({
  params: Promise.resolve({ slug }),
  searchParams: Promise.resolve({}),
})

/** The visible trail after Home, and the JSON-LD trail after Home, as names. */
function trails(): { visible: string[]; jsonLd: string[] | undefined } {
  const nav = screen.getByRole("navigation", { name: "breadcrumb" })
  const visible = within(nav)
    .getAllByRole("listitem")
    .map((item) => item.textContent?.trim() ?? "")
    .filter((name) => name && name !== "Home")
  const data = jsonLd.mock.calls.flatMap(([d]) => d as Crumbs[])
  const crumbs = data.find((d) => d["@type"] === "BreadcrumbList")
  return { visible, jsonLd: crumbs?.itemListElement.slice(1).map(({ name }) => name) }
}

const author = authors[0]!
const topic = topics[0]!
const volume = volumes[0]!

beforeEach(() => {
  vi.clearAllMocks()
  find.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, page: 1 })
  queries.queryUserBySlug.mockResolvedValue(author)
  queries.queryTopicBySlug.mockResolvedValue(topic)
  queries.queryVolumeBySlug.mockResolvedValue(volume)
})
afterEach(cleanup)

describe("breadcrumb trails", () => {
  it("names an author by their name, and tells search engines the same", async () => {
    const { default: AuthorPage } = await import("../contributors/[slug]/page")
    render((await AuthorPage(args(author.slug!))) as React.ReactElement)

    expect(screen.getByRole("link", { name: "Contributors" })).toHaveAttribute(
      "href",
      "/contributors",
    )
    expect(trails()).toEqual({
      visible: ["Contributors", author.name],
      jsonLd: ["Contributors", author.name],
    })
  })

  it("names a topic by its name", async () => {
    const { default: TopicPage } = await import("../topics/[slug]/page")
    render((await TopicPage(args(topic.slug!))) as React.ReactElement)

    expect(screen.getByRole("link", { name: "Topics" })).toHaveAttribute("href", "/topics")
    expect(trails().visible).toEqual(["Topics", topic.name])
  })

  it("numbers a volume in roman numerals, and tells search engines the same", async () => {
    const { default: VolumePage } = await import("../volumes/[slug]/page")
    render((await VolumePage(args(volume.slug!))) as React.ReactElement)

    expect(screen.getByRole("link", { name: "Volumes" })).toHaveAttribute("href", "/volumes")
    expect(trails()).toEqual({
      visible: ["Volumes", "Volume XII"],
      jsonLd: ["Volumes", "Volume XII"],
    })
  })
})
