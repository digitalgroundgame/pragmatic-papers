import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { querySitePage, renderBlocks, renderPanels } = vi.hoisted(() => ({
  querySitePage: vi.fn(),
  renderBlocks: vi.fn(),
  renderPanels: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("@/data/queries", () => ({ querySitePage }))
vi.mock("@/utilities/generateMeta", () => ({ generateMeta: vi.fn(), paginatedPath: vi.fn() }))
vi.mock("@/components/LivePreviewListener", () => ({ LivePreviewListener: () => null }))
// The list and the panels have their own tests: here they render as markers.
vi.mock("@/blocks/RenderBlocks", () => ({
  RenderBlocks: ({ blocks, ...props }: { blocks: unknown }) => {
    renderBlocks(blocks, props)
    return null
  },
}))
vi.mock("@/blocks/Panel/Component", () => ({
  hasPanels: (panels: unknown[] | null | undefined) => Boolean(panels?.length),
  RenderPanels: ({ panels }: { panels: unknown }) => {
    renderPanels(panels)
    return <p>panels</p>
  },
}))
vi.mock("@/components/Aside", () => ({
  WithAside: ({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) => (
    <>
      {children}
      {aside && <aside>{aside}</aside>}
    </>
  ),
}))

import TopicsPage from "../page"

const renderPage = async (p?: string) =>
  render((await TopicsPage({ searchParams: Promise.resolve({ p }) })) as React.ReactElement)

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe("/topics", () => {
  it("shows what it showed as code until the Topics page is published", async () => {
    querySitePage.mockResolvedValue(null)
    await renderPage()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Topics")
    expect(screen.getByText("Browse all topics")).toBeInTheDocument()
    expect(renderBlocks).toHaveBeenCalledWith(
      [expect.objectContaining({ blockType: "topicsList" })],
      {
        pageNumber: 1,
        paginated: true,
      },
    )
    expect(renderPanels.mock.calls[0]![0].map((p: { source: string }) => p.source)).toEqual([
      "mostRead",
      "latestVolume",
      "newsletter",
    ])
  })

  it("takes its title, layout and aside from the published page", async () => {
    const layout = [{ blockType: "topicsList", id: "a" }]
    const aside = [{ blockType: "panel", source: "topics", id: "b" }]
    querySitePage.mockResolvedValue({
      title: "Every topic",
      hero: { type: "none" },
      layout,
      aside,
    })
    await renderPage("2")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Every topic")
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toHaveTextContent("Every topic")
    expect(renderBlocks).toHaveBeenCalledWith(layout, { pageNumber: 2, paginated: true })
    expect(renderPanels).toHaveBeenCalledWith(aside)
  })

  it("gives the list the page's width when an editor empties the aside", async () => {
    querySitePage.mockResolvedValue({
      title: "Topics",
      hero: { type: "none" },
      layout: [],
      aside: [],
    })
    await renderPage()
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
    // An empty layout still lists the topics.
    expect(renderBlocks.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ blockType: "topicsList" }),
    ])
  })
})
