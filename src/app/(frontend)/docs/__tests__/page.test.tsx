import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { queryPublishedDocs } = vi.hoisted(() => ({ queryPublishedDocs: vi.fn() }))
vi.mock("@/plugins/docs/queries", () => ({ queryPublishedDocs }))

import DocsIndexPage, { generateMetadata } from "../page"

const renderPage = async () => render((await DocsIndexPage()) as React.ReactElement)

afterEach(cleanup)

describe("DocsIndexPage", () => {
  it("lists each doc with its summary and date, linking to it", async () => {
    queryPublishedDocs.mockResolvedValue([
      {
        id: 1,
        slug: "unsplash-photos",
        title: "Find photos on Unsplash",
        summary: "Search Unsplash from Media.",
        publishedAt: "2026-10-18T00:00:00.000Z",
      },
    ])
    await renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Docs" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Find photos on Unsplash/ })).toHaveAttribute(
      "href",
      "/docs/unsplash-photos",
    )
    expect(screen.getByText("Search Unsplash from Media.")).toBeInTheDocument()
    expect(screen.getByText("October 18, 2026")).toHaveAttribute("datetime", "2026-10-18")
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toHaveTextContent("Docs")
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
