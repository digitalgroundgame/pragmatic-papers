import { cleanup, render, screen, within } from "@testing-library/react"
import type React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { queryPublishedDocs } = vi.hoisted(() => ({ queryPublishedDocs: vi.fn() }))
vi.mock("@/plugins/docs/queries", () => ({ queryPublishedDocs }))

import DocsIndexPage, { generateMetadata } from "../page"

const renderPage = async () => render((await DocsIndexPage()) as React.ReactElement)

const docs = [
  {
    id: 1,
    slug: "unsplash-photos",
    title: "Find photos on Unsplash",
    summary: "Search Unsplash from Media.",
    publishedAt: "2026-10-18T00:00:00.000Z",
    section: "media",
    heroImage: { url: "/hero.webp", sizes: { thumbnail: { url: "/hero-300x158.webp" } } },
  },
  {
    id: 2,
    slug: "footnotes",
    title: "Footnotes",
    summary: "Cite your sources.",
    publishedAt: "2026-03-04T00:00:00.000Z",
    section: "writing",
  },
]

afterEach(cleanup)

describe("DocsIndexPage", () => {
  it("lists the newest docs with their dates", async () => {
    queryPublishedDocs.mockResolvedValue(docs)
    await renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Docs" })).toBeInTheDocument()
    const latest = screen.getByRole("region", { name: "What's new" })
    expect(within(latest).getByRole("link", { name: /Find photos on Unsplash/ })).toHaveAttribute(
      "href",
      "/docs/unsplash-photos",
    )
    expect(within(latest).getByText("October 18, 2026")).toHaveAttribute("datetime", "2026-10-18")
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toHaveTextContent("Docs")
  })

  it("shows each new doc's thumbnail and summary, and every doc by section in the sidebar", async () => {
    queryPublishedDocs.mockResolvedValue(docs)
    await renderPage()
    const latest = screen.getByRole("region", { name: "What's new" })
    const card = within(latest).getByRole("link", { name: /Find photos on Unsplash/ })
    expect(card).toHaveTextContent("Search Unsplash from Media.")
    expect(card.querySelector("img")).toHaveAttribute("src", "/hero-300x158.webp")
    expect(screen.queryByRole("region", { name: "Writing articles" })).not.toBeInTheDocument()

    const nav = screen.getByRole("navigation", { name: "Docs" })
    expect(within(nav).getByRole("link", { name: "All docs" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(within(nav).getByRole("list", { name: "Writing articles" })).toHaveTextContent(
      "Footnotes",
    )
  })

  it("says so when there are no docs", async () => {
    queryPublishedDocs.mockResolvedValue([])
    await renderPage()
    expect(screen.getByText("No docs yet.")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
  })

  it("has a canonical URL and title", () => {
    const meta = generateMetadata()
    expect(meta.title).toBe("Docs — Pragmatic Papers")
    expect(meta.alternates?.canonical).toMatch(/\/docs$/)
  })
})
