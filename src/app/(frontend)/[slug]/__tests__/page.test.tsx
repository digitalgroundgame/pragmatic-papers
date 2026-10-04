import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queryPageBySlug, jsonLd } = vi.hoisted(() => ({
  queryPageBySlug: vi.fn(),
  jsonLd: vi.fn(),
}))

vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: async () => ({ find: vi.fn() }) }))
vi.mock("@/utilities/queries", () => ({ queryPageBySlug }))
vi.mock("@/utilities/getGlobals", () => ({ getCachedGlobal: () => async () => ({ socials: [] }) }))
vi.mock("@/utilities/generateMeta", () => ({ generateMeta: vi.fn() }))
vi.mock("@/endpoints/seed/home-static", () => ({ homeStatic: null }))
// Children with their own tests render as markers: these tests are about the trail.
vi.mock("@/heros/RenderHero", () => ({ RenderHero: () => null }))
vi.mock("@/blocks/RenderBlocks", () => ({ RenderBlocks: () => null }))
vi.mock("@/components/PayloadRedirects", () => ({ PayloadRedirects: () => null }))
vi.mock("@/components/LivePreviewListener", () => ({ LivePreviewListener: () => null }))
vi.mock("@/components/JsonLd", () => ({
  JsonLd: ({ data }: { data: unknown }) => {
    jsonLd(data)
    return null
  },
}))

import Page from "../page"

const renderPage = async (slug?: string) =>
  render(
    (await Page({
      params: Promise.resolve(slug === undefined ? {} : { slug }),
      searchParams: Promise.resolve({}),
    })) as React.ReactElement,
  )

interface Crumbs { itemListElement: { name: string; item: string }[] }

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
