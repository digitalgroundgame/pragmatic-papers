import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FEEDS, SITEMAPS } from "@/data/feeds"

import { FeedsListBlock } from "../Component"

const SITE_URL = "https://pragmaticpapers.com"

beforeEach(() => vi.stubEnv("SERVER_URL", SITE_URL))
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe("FeedsListBlock", () => {
  it("links every RSS feed, with its full address", () => {
    render(<FeedsListBlock blockType="feedsList" list="feeds" title="RSS feeds" />)
    const section = within(screen.getByRole("region", { name: "RSS feeds" }))
    for (const feed of FEEDS) {
      expect(section.getByRole("link", { name: feed.title })).toHaveAttribute("href", feed.path)
      expect(section.getByText(`${SITE_URL}${feed.path}`)).toBeInTheDocument()
    }
    expect(section.getAllByRole("link")).toHaveLength(FEEDS.length)
  })

  it("explains the Substack feed is for Substack's importer", () => {
    render(<FeedsListBlock blockType="feedsList" list="feeds" />)
    expect(screen.getByRole("link", { name: "Substack syndication" })).toHaveAttribute(
      "href",
      "/articles/substack.xml",
    )
    expect(screen.getByText(/Substack's importer/)).toBeInTheDocument()
  })

  it("links the sitemap index and every sitemap it lists", () => {
    render(<FeedsListBlock blockType="feedsList" list="sitemaps" title="Sitemaps" />)
    const section = within(screen.getByRole("region", { name: "Sitemaps" }))
    expect(section.getByRole("link", { name: "Sitemap index" })).toHaveAttribute(
      "href",
      "/sitemap_index.xml",
    )
    for (const sitemap of SITEMAPS) {
      expect(section.getByRole("link", { name: sitemap.title })).toHaveAttribute(
        "href",
        sitemap.path,
      )
    }
    expect(section.getAllByRole("link")).toHaveLength(SITEMAPS.length + 1)
  })

  it("shows the editor's heading and introduction", () => {
    render(
      <FeedsListBlock
        blockType="feedsList"
        list="feeds"
        title="Follow along"
        description="Paste an address into your reader."
      />,
    )
    expect(screen.getByRole("heading", { level: 2, name: "Follow along" })).toBeInTheDocument()
    expect(screen.getByText("Paste an address into your reader.")).toBeInTheDocument()
  })

  it("leaves out the heading when there's none", () => {
    render(<FeedsListBlock blockType="feedsList" list="feeds" />)
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })
})
