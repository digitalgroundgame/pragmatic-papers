import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { queryPublishedDocs, isStaffReader } = vi.hoisted(() => ({
  queryPublishedDocs: vi.fn(),
  isStaffReader: vi.fn(async () => false),
}))
vi.mock("@/plugins/docs/queries", () => ({ queryPublishedDocs, isStaffReader }))

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

  it.each([
    ["a visitor", false],
    ["staff, who also see docs written for some roles", true],
  ])("lists the docs %s can read", async (_, staff) => {
    isStaffReader.mockResolvedValueOnce(staff)
    queryPublishedDocs.mockResolvedValue([])
    await renderPage()
    expect(queryPublishedDocs).toHaveBeenCalledWith({ staff })
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
