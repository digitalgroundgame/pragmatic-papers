import { describe, it, expect, vi } from "vitest"
import type { Article, Volume } from "@/payload-types"

// Mock dependencies
vi.mock("@/utilities/getURL", () => ({
  getServerSideURL: () => "http://localhost:3000",
}))

vi.mock("@/utilities/getMediaUrl", () => ({
  getMediaUrl: vi.fn((url: string) => url || undefined),
}))

vi.mock("@payloadcms/richtext-lexical/plaintext", () => ({
  convertLexicalToPlaintext: vi.fn(() => "plain text bio"),
}))

import {
  buildArticleJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildPeriodicalJsonLd,
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildHomeJsonLd,
  buildVolumeJsonLd,
} from "./structuredData"

describe("structuredData", () => {
  describe("buildWebSiteJsonLd", () => {
    it("returns WebSite schema with correct structure", () => {
      const result = buildWebSiteJsonLd()
      expect(result["@context"]).toBe("https://schema.org")
      expect(result["@type"]).toBe("WebSite")
      expect(result.name).toBe("The Pragmatic Papers")
      expect(result.url).toBe("http://localhost:3000")
    })
  })

  describe("buildPeriodicalJsonLd", () => {
    it("returns Periodical schema with correct structure", () => {
      const result = buildPeriodicalJsonLd()
      expect(result["@context"]).toBe("https://schema.org")
      expect(result["@type"]).toBe("Periodical")
      expect(result.name).toBe("The Pragmatic Papers")
    })
  })

  describe("buildOrganizationJsonLd", () => {
    it("returns Organization schema without sameAs when not provided", () => {
      const result = buildOrganizationJsonLd()
      expect(result["@type"]).toBe("Organization")
      expect(result.sameAs).toBeUndefined()
    })

    it("returns Organization schema with sameAs when provided", () => {
      const result = buildOrganizationJsonLd(["https://twitter.com/pp"])
      expect(result.sameAs).toEqual(["https://twitter.com/pp"])
    })
  })

  describe("buildBreadcrumbJsonLd", () => {
    it("returns BreadcrumbList with Home when no items provided", () => {
      const result = buildBreadcrumbJsonLd()
      expect(result["@type"]).toBe("BreadcrumbList")
      expect(result.itemListElement).toHaveLength(1)
      expect(Array.isArray(result.itemListElement) && result.itemListElement[0]).toMatchObject({
        "@type": "ListItem",
        position: 1,
        name: "Home",
      })
    })

    it("includes additional items in breadcrumb", () => {
      const result = buildBreadcrumbJsonLd([{ name: "Articles", path: "/articles" }])
      expect(result.itemListElement).toHaveLength(2)
      expect(Array.isArray(result.itemListElement) && result.itemListElement[1]).toMatchObject({
        position: 2,
        name: "Articles",
      })
    })
  })

  describe("buildCollectionPageJsonLd", () => {
    it("returns CollectionPage schema", () => {
      const result = buildCollectionPageJsonLd("All Articles", "List of articles", "/articles")
      expect(result["@type"]).toBe("CollectionPage")
      expect(result.name).toBe("All Articles")
      expect(result.description).toBe("List of articles")
    })
  })

  describe("buildHomeJsonLd", () => {
    it("returns array with website, organization, periodical, and breadcrumb", () => {
      const result = buildHomeJsonLd()
      expect(result).toHaveLength(4)
      expect(result[0] && "@type" in result[0] && result[0]["@type"]).toBe("WebSite")
      expect(result[1] && "@type" in result[1] && result[1]["@type"]).toBe("Organization")
      expect(result[2] && "@type" in result[2] && result[2]["@type"]).toBe("Periodical")
      expect(result[3] && "@type" in result[3] && result[3]["@type"]).toBe("BreadcrumbList")
    })
  })

  describe("buildArticleJsonLd", () => {
    it("returns Article schema with minimal data", () => {
      const article = {
        id: "1",
        title: "Test Article",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        populatedAuthors: [],
        topics: [],
      } as unknown as Article

      const result = buildArticleJsonLd(article, "/articles/test")
      expect(result["@type"]).toBe("Article")
      expect(result.headline).toBe("Test Article")
    })
  })

  describe("buildVolumeJsonLd", () => {
    it("returns PublicationVolume schema", () => {
      const volume = {
        id: "1",
        title: "Volume 1",
        volumeNumber: 1,
        publishedAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      } as unknown as Volume

      const result = buildVolumeJsonLd(volume, "/volumes/1")
      expect(result["@type"]).toBe("PublicationVolume")
      expect(result.name).toBe("Volume 1")
      expect(result.volumeNumber).toBe(1)
    })
  })
})
