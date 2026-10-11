import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queryPageBySlug, jsonLd, renderBlocks, generateMeta } = vi.hoisted(() => ({
  queryPageBySlug: vi.fn(),
  jsonLd: vi.fn(),
  renderBlocks: vi.fn(),
  generateMeta: vi.fn(),
}))

vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: async () => ({ find: vi.fn() }) }))
vi.mock("@/data/queries", () => ({ queryPageBySlug }))
vi.mock("@/data/globals", () => ({ getGlobal: async () => ({ socials: [] }) }))
vi.mock("@/utilities/generateMeta", () => ({ generateMeta }))
vi.mock("@/endpoints/seed/home-static", () => ({ homeStatic: null }))
// Children with their own tests render as markers: these tests are about the trail.
vi.mock("@/heros/RenderHero", () => ({ RenderHero: () => null }))
vi.mock("@/blocks/RenderBlocks", () => ({
  RenderBlocks: ({ blocks }: { blocks: unknown }) => {
    renderBlocks(blocks)
    return null
  },
}))
vi.mock("@/components/PayloadRedirects", () => ({ PayloadRedirects: () => null }))
vi.mock("@/components/LivePreviewListener", () => ({ LivePreviewListener: () => null }))
vi.mock("@/components/JsonLd", () => ({
  JsonLd: ({ data }: { data: unknown }) => {
    jsonLd(data)
    return null
  },
}))

import Page, { generateMetadata } from "../page"

const renderPage = async (slug?: string) =>
  render(
    (await Page({
      params: Promise.resolve(slug === undefined ? {} : { slug }),
      searchParams: Promise.resolve({}),
    })) as React.ReactElement,
  )

interface Crumbs {
  itemListElement: { name: string; item: string }[]
}

beforeEach(() => {
  vi.clearAllMocks()
  queryPageBySlug.mockResolvedValue({
    slug: "about",
    title: "About the Papers",
    meta: { title: "About | Pragmatic Papers" },
    hero: { type: "none" },
    layout: [],
  })
})
afterEach(cleanup)

describe("CMS page trail", () => {
  it("names the page by its title, not its slug", async () => {
    await renderPage("about")
    const nav = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(nav).toHaveClass("max-w-3xl")
    expect(nav).toHaveTextContent("About the Papers")
  })

  it("gives search engines the same trail readers see", async () => {
    await renderPage("about")
    const [crumbs] = jsonLd.mock.calls[0]![0] as Crumbs[]
    expect(crumbs!.itemListElement.map(({ name }) => name)).toEqual(["Home", "About the Papers"])
    expect(crumbs!.itemListElement[1]!.item).toMatch(/\/about$/)
  })

  it("shows no trail on the home page", async () => {
    await renderPage()
    expect(queryPageBySlug).toHaveBeenCalledWith("home")
    expect(screen.queryByRole("navigation", { name: "breadcrumb" })).not.toBeInTheDocument()
  })
})

describe("/feeds", () => {
  it("shows the default feeds page until an editor makes one", async () => {
    queryPageBySlug.mockResolvedValue(null)
    await renderPage("feeds")
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toHaveTextContent(
      "Feeds and sitemaps",
    )
    const [blocks] = renderBlocks.mock.calls[0]! as [{ blockType: string; list: string }[]]
    expect(blocks.map(({ blockType, list }) => [blockType, list])).toEqual([
      ["feedsList", "feeds"],
      ["feedsList", "sitemaps"],
    ])
  })

  it("renders the layout of a page slugged feeds", async () => {
    const layout = [{ blockType: "feedsList", list: "sitemaps", title: "Just sitemaps" }]
    queryPageBySlug.mockResolvedValue({
      slug: "feeds",
      title: "Our feeds",
      hero: { type: "none" },
      layout,
    })
    await renderPage("feeds")
    expect(queryPageBySlug).toHaveBeenCalledWith("feeds")
    expect(renderBlocks).toHaveBeenCalledWith(layout)
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toHaveTextContent("Our feeds")
  })

  it("describes the default feeds page to search engines", async () => {
    queryPageBySlug.mockResolvedValue(null)
    await generateMetadata({
      params: Promise.resolve({ slug: "feeds" }),
      searchParams: Promise.resolve({}),
    })
    expect(generateMeta).toHaveBeenCalledWith({
      doc: expect.objectContaining({
        meta: expect.objectContaining({ title: "Feeds and sitemaps — Pragmatic Papers" }),
      }),
      canonicalPath: "/feeds",
    })
  })

  it("has no default for other slugs", async () => {
    queryPageBySlug.mockResolvedValue(null)
    await renderPage("missing")
    expect(renderBlocks).not.toHaveBeenCalled()
    expect(screen.queryByRole("navigation", { name: "breadcrumb" })).not.toBeInTheDocument()
  })
})
