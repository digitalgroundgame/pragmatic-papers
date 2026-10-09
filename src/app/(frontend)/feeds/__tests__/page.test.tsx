import { cleanup, render, screen, within } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SITEMAPS } from "../../(sitemaps)/sitemaps"
import { FEEDS } from "../feeds"
import FeedsPage, { generateMetadata } from "../page"

const SITE_URL = "https://pragmaticpapers.com"

const renderPage = () => render(FeedsPage() as React.ReactElement)

beforeEach(() => vi.stubEnv("SERVER_URL", SITE_URL))
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

const section = (name: string) =>
  screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement

describe("FeedsPage", () => {
  it("links every RSS feed, with its full address", () => {
    renderPage()
    const feeds = within(section("RSS feeds"))
    for (const feed of FEEDS) {
      expect(feeds.getByRole("link", { name: feed.title })).toHaveAttribute("href", feed.path)
      expect(feeds.getByText(`${SITE_URL}${feed.path}`)).toBeInTheDocument()
    }
  })

  it("links the sitemap index and every sitemap it lists", () => {
    renderPage()
    const sitemaps = within(section("Sitemaps"))
    expect(sitemaps.getByRole("link", { name: "Sitemap index" })).toHaveAttribute(
      "href",
      "/sitemap.xml",
    )
    for (const sitemap of SITEMAPS) {
      expect(sitemaps.getByRole("link", { name: sitemap.title })).toHaveAttribute(
        "href",
        sitemap.path,
      )
    }
    expect(sitemaps.getAllByRole("link")).toHaveLength(SITEMAPS.length + 1)
  })

  it("has a canonical URL and title", () => {
    const meta = generateMetadata()
    expect(meta.title).toBe("Feeds and sitemaps — Pragmatic Papers")
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/feeds`)
  })
})
