import { cleanup, render, screen, within } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { docParentId, docTreeParents } from "@/stories/fixtures/docsTree"

const { queries } = vi.hoisted(() => ({
  queries: {
    queryDocBySlug: vi.fn(),
    queryPublishedDocs: vi.fn(),
  },
}))

vi.mock("server-only", () => ({}))
vi.mock("@/plugins/docs/queries", () => queries)
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async () => true,
}))
vi.mock("@/globals/Plugins/isPluginEnabled", () => ({
  isPluginEnabled: async () => true,
}))

import { DocView } from "../[...path]/DocView"
import DocsHomePage, { generateMetadata } from "../page"

const home = {
  id: 100,
  slug: "home",
  title: "Pragmatic Papers docs",
  navTitle: "Home",
  summary: "How Pragmatic Papers works.",
  publishedAt: "2026-10-10T00:00:00.000Z",
  content: {
    root: {
      type: "root",
      version: 1,
      children: [
        { type: "paragraph", version: 1, children: [{ type: "text", text: "Hi.", version: 1 }] },
      ],
    },
  },
}
const footnotes = {
  id: 102,
  slug: "footnotes",
  title: "Add footnotes",
  navTitle: "Footnotes",
  summary: "Cite your sources.",
  publishedAt: "2026-03-04T00:00:00.000Z",
  parent: docParentId("articles"),
}

// The page hands the home slug to DocView, an async component the test renders itself.
const renderPage = async () => {
  const page = (await DocsHomePage()) as React.ReactElement<React.ComponentProps<typeof DocView>>
  return render((await DocView(page.props)) as React.ReactElement)
}

beforeEach(() => {
  queries.queryDocBySlug.mockResolvedValue(home)
  queries.queryPublishedDocs.mockResolvedValue([home, footnotes, ...docTreeParents])
})
afterEach(cleanup)

describe("DocsHomePage", () => {
  it("shows the home doc, current in the sidebar, which lists it only as Home", async () => {
    await renderPage()
    expect(
      screen.getByRole("heading", { level: 1, name: "Pragmatic Papers docs" }),
    ).toBeInTheDocument()
    const nav = screen.getByRole("navigation", { name: "Docs" })
    expect(screen.getAllByRole("link", { name: "Home" }).at(0)).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(within(nav).getByRole("link", { name: "Footnotes" })).toHaveAttribute(
      "href",
      "/docs/writing/articles/footnotes",
    )
    // The first area follows Home.
    expect(screen.getByRole("link", { name: /Next.*Writing/ })).toHaveAttribute(
      "href",
      "/docs/writing",
    )
  })

  it("falls back to What's new until the home doc has synced", async () => {
    queries.queryDocBySlug.mockResolvedValue(null)
    await renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "What's new" })).toBeInTheDocument()
  })
})

describe("generateMetadata", () => {
  it("is the home doc's, at /docs", async () => {
    const meta = await generateMetadata()
    expect(meta.title).toBe("Pragmatic Papers docs — Pragmatic Papers")
    expect(meta.alternates?.canonical).toMatch(/\/docs$/)
  })
})
