import { cleanup, render, screen, within } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queryPublishedDocs, experiment } = vi.hoisted(() => ({
  queryPublishedDocs: vi.fn(),
  experiment: { enabled: true },
}))
vi.mock("@/plugins/docs/queries", () => ({ queryPublishedDocs }))
vi.mock("@/globals/Plugins/isPluginEnabled", () => ({
  isPluginEnabled: async () => experiment.enabled,
}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound")
  },
}))

import WhatsNewPage, { generateMetadata } from "../page"

const renderPage = async () => render((await WhatsNewPage()) as React.ReactElement)

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

beforeEach(() => {
  experiment.enabled = true
})
afterEach(cleanup)

describe("WhatsNewPage", () => {
  it("is What's new: every doc, newest first, with its date", async () => {
    queryPublishedDocs.mockResolvedValue(docs)
    await renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "What's new" })).toBeInTheDocument()
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
    expect(
      within(latest).queryByRole("region", { name: "Writing articles" }),
    ).not.toBeInTheDocument()

    const nav = screen.getByRole("navigation", { name: "Docs" })
    expect(within(nav).getByRole("link", { name: "What's new" })).toHaveAttribute(
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

  it("is not found while the docs experiment is off", async () => {
    experiment.enabled = false
    await expect(WhatsNewPage()).rejects.toThrow("notFound")
    await expect(generateMetadata()).resolves.toEqual({})
  })

  it("has a canonical URL and title", async () => {
    const meta = await generateMetadata()
    expect(meta.title).toBe("What's new — Pragmatic Papers docs")
    expect(meta.alternates?.canonical).toMatch(/\/docs\/whats-new$/)
  })
})
