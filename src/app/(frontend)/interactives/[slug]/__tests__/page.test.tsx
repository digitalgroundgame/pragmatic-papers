import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { load, draft, generateMeta, drilldown } = vi.hoisted(() => ({
  load: { queryInteractiveBySlug: vi.fn(), loadInteractiveOverview: vi.fn() },
  draft: { isEnabled: false },
  generateMeta: vi.fn(async () => ({ title: "meta" })),
  drilldown: vi.fn(),
}))

vi.mock("@/interactives/load", () => load)
vi.mock("next/headers", () => ({ draftMode: async () => draft }))
vi.mock("@/utilities/generateMeta", () => ({ generateMeta }))
// Children with their own tests (or server-only dependencies) render as markers, so these
// tests are about what the page decides, not how the map draws.
vi.mock("@/components/PayloadRedirects", () => ({
  PayloadRedirects: ({ url, disableNotFound }: { url: string; disableNotFound?: boolean }) => (
    <div
      data-testid="redirects"
      data-url={url}
      data-disable-not-found={String(!!disableNotFound)}
    />
  ),
}))
vi.mock("@/components/LivePreviewListener", () => ({
  LivePreviewListener: () => <div data-testid="live-preview" />,
}))
vi.mock("@/components/RichText", () => ({
  default: () => <div data-testid="intro" />,
}))
vi.mock("@/blocks/InteractiveMap/Sources", () => ({
  Sources: () => <div data-testid="sources" />,
}))
vi.mock("@/interactives/InteractiveDrilldown", () => ({
  InteractiveDrilldown: (props: unknown) => {
    drilldown(props)
    return <div data-testid="drilldown" />
  },
}))

import InteractivePage, { generateMetadata } from "../page"

const interactive = {
  id: 5,
  slug: "courts",
  title: "Federal Court Appointment Tracker",
  intro: { root: { children: [] } },
  sources: [],
}
const composed = {
  generatedAt: "2026-09-20T18:00:00.000Z",
  source: { name: "court-tracker" },
  metaLine: "last appointment Sep 18, 2026",
  searchUrl: "/interactives/courts/search",
}

const args = (slug?: string) => ({ params: Promise.resolve(slug === undefined ? {} : { slug }) })
const renderPage = async (slug = "courts") =>
  render((await InteractivePage(args(slug))) as React.ReactElement)

beforeEach(() => {
  vi.clearAllMocks()
  draft.isEnabled = false
  load.queryInteractiveBySlug.mockResolvedValue(interactive)
  load.loadInteractiveOverview.mockResolvedValue(composed)
})
afterEach(cleanup)

describe("InteractivePage", () => {
  it("hands an unknown slug to the redirects, which 404 what they can't redirect", async () => {
    load.queryInteractiveBySlug.mockResolvedValue(null)
    await renderPage("nope")
    expect(screen.getByTestId("redirects")).toHaveAttribute("data-url", "/interactives/nope")
    expect(screen.getByTestId("redirects")).toHaveAttribute("data-disable-not-found", "false")
    expect(load.loadInteractiveOverview).not.toHaveBeenCalled()
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })

  it("renders the title, intro, data line and map from the published snapshot", async () => {
    await renderPage()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(interactive.title)
    expect(screen.getByTestId("intro")).toBeInTheDocument()
    const meta = document.querySelector("[data-interactive-meta]")
    expect(meta).toHaveTextContent(
      "Data as of September 20, 2026 · synced from court-tracker · last appointment Sep 18, 2026",
    )
    expect(meta?.querySelector("time")).toHaveAttribute("datetime", composed.generatedAt)
    expect(drilldown).toHaveBeenCalledWith(
      expect.objectContaining({ composed, searchLabel: "Search judges" }),
    )
    expect(screen.getByTestId("sources")).toBeInTheDocument()
    // Redirects still run on a found page, but never turn it into a 404.
    expect(screen.getByTestId("redirects")).toHaveAttribute("data-disable-not-found", "true")
  })

  it("trails Interactives to this one by its title, as wide as the page it sits on", async () => {
    await renderPage()
    const nav = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(nav).not.toHaveClass("max-w-3xl")
    expect(screen.getByRole("link", { name: "Interactives" })).toHaveAttribute(
      "href",
      "/interactives",
    )
    expect(nav).toHaveTextContent(interactive.title)
  })

  it("leaves out the data line's extra when the snapshot has none", async () => {
    load.loadInteractiveOverview.mockResolvedValue({ ...composed, metaLine: undefined })
    await renderPage()
    expect(document.querySelector("[data-interactive-meta]")).toHaveTextContent(
      /synced from court-tracker$/,
    )
  })

  it("tells readers there is no data yet when nothing is published", async () => {
    load.loadInteractiveOverview.mockResolvedValue(null)
    await renderPage()
    expect(document.querySelector("[data-interactive-empty]")).toHaveTextContent(
      "This interactive has no published data yet.",
    )
    expect(screen.queryByTestId("drilldown")).not.toBeInTheDocument()
    expect(document.querySelector("[data-interactive-meta]")).not.toBeInTheDocument()
  })

  it("tells an editor in preview how to get data, and listens for live edits", async () => {
    draft.isEnabled = true
    load.loadInteractiveOverview.mockResolvedValue(null)
    await renderPage()
    expect(screen.getByTestId("live-preview")).toBeInTheDocument()
    expect(document.querySelector("[data-interactive-empty]")).toHaveTextContent(
      /Run the sync from Snapshots/,
    )
  })

  it("has no live-preview listener outside draft mode", async () => {
    await renderPage()
    expect(screen.queryByTestId("live-preview")).not.toBeInTheDocument()
  })
})

describe("generateMetadata", () => {
  it("builds metadata from the interactive with its own canonical path", async () => {
    await expect(generateMetadata(args("courts"))).resolves.toEqual({ title: "meta" })
    expect(generateMeta).toHaveBeenCalledWith({
      doc: interactive,
      canonicalPath: "/interactives/courts",
    })
  })

  it("treats a missing slug as empty rather than throwing", async () => {
    load.queryInteractiveBySlug.mockResolvedValue(null)
    await generateMetadata(args())
    expect(load.queryInteractiveBySlug).toHaveBeenCalledWith("")
  })
})
