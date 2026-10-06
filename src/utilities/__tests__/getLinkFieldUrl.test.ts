import { describe, expect, it } from "vitest"

import type { LinkField } from "@/payload-types"
import { getLinkFieldUrl, linksToUnpublished } from "@/utilities/getLinkFieldUrl"

type RelationTo = NonNullable<LinkField["reference"]>["relationTo"]

const reference = (relationTo: RelationTo, value: unknown, url?: string): LinkField =>
  ({ type: "reference", reference: { relationTo, value }, url }) as LinkField

describe("getLinkFieldUrl", () => {
  it("returns null when there is no link", () => {
    expect(getLinkFieldUrl()).toBeNull()
  })

  describe("reference links", () => {
    it("links a page at the site root", () => {
      expect(getLinkFieldUrl(reference("pages", { id: 1, slug: "about" }))).toBe("/about")
    })

    it("links the home page to /", () => {
      expect(getLinkFieldUrl(reference("pages", { id: 1, slug: "home" }))).toBe("/")
    })

    it("prefixes other collections with their slug", () => {
      expect(getLinkFieldUrl(reference("articles", { id: 1, slug: "the-case" }))).toBe(
        "/articles/the-case",
      )
      expect(getLinkFieldUrl(reference("volumes", { id: 1, slug: "7" }))).toBe("/volumes/7")
      expect(getLinkFieldUrl(reference("topics", { id: 1, slug: "economics" }))).toBe(
        "/topics/economics",
      )
    })

    it("keeps the collection prefix for a non-page slugged home", () => {
      expect(getLinkFieldUrl(reference("articles", { id: 1, slug: "home" }))).toBe("/articles/home")
    })

    it("falls back to the url when the reference is not populated", () => {
      expect(getLinkFieldUrl(reference("pages", 1, "/fallback"))).toBe("/fallback")
      expect(getLinkFieldUrl(reference("pages", 1))).toBeNull()
    })

    it("falls back to the url when the referenced document has no slug", () => {
      expect(getLinkFieldUrl(reference("articles", { id: 1, slug: null }, "/fallback"))).toBe(
        "/fallback",
      )
    })
  })

  describe("custom links", () => {
    it("returns the url as written", () => {
      expect(getLinkFieldUrl({ type: "custom", url: "https://example.com/a?b=c" })).toBe(
        "https://example.com/a?b=c",
      )
    })

    it("returns null for a missing or empty url", () => {
      expect(getLinkFieldUrl({ type: "custom" })).toBeNull()
      expect(getLinkFieldUrl({ type: "custom", url: null })).toBeNull()
      expect(getLinkFieldUrl({ type: "custom", url: "" })).toBeNull()
    })
  })
})

describe("linksToUnpublished", () => {
  it("is true only for a populated reference whose document is a draft", () => {
    expect(linksToUnpublished(reference("pages", { id: 1, slug: "a", _status: "draft" }))).toBe(
      true,
    )
    expect(
      linksToUnpublished(reference("articles", { id: 1, slug: "a", _status: "published" })),
    ).toBe(false)
  })

  it("is false for a collection without drafts, an unpopulated reference, or a custom URL", () => {
    expect(linksToUnpublished(reference("topics", { id: 1, slug: "economics" }))).toBe(false)
    expect(linksToUnpublished(reference("pages", 42))).toBe(false)
    expect(linksToUnpublished({ type: "custom", url: "/x" })).toBe(false)
    expect(linksToUnpublished()).toBe(false)
  })
})
