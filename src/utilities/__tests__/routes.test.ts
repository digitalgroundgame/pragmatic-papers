import type { SerializedLinkNode } from "@payloadcms/richtext-lexical"
import { describe, expect, it } from "vitest"

import { docPath, internalDocToHref } from "@/utilities/routes"

const linkTo = (relationTo: string, value: unknown): { linkNode: SerializedLinkNode } =>
  ({ linkNode: { fields: { doc: { relationTo, value } } } }) as unknown as {
    linkNode: SerializedLinkNode
  }

describe("docPath", () => {
  it("serves pages at the root and the home page at /", () => {
    expect(docPath("pages", "about")).toBe("/about")
    expect(docPath("pages", "home")).toBe("/")
  })

  it("prefixes every other routed collection", () => {
    expect(docPath("articles", "the-case")).toBe("/articles/the-case")
    expect(docPath("volumes", "7")).toBe("/volumes/7")
    expect(docPath("topics", "labor")).toBe("/topics/labor")
    expect(docPath("interactives", "federal-courts")).toBe("/interactives/federal-courts")
  })

  it("serves an unmapped collection under its own slug", () => {
    expect(docPath("categories", "x")).toBe("/categories/x")
  })
})

describe("internalDocToHref", () => {
  it("links volumes under /volumes", () => {
    expect(internalDocToHref(linkTo("volumes", { slug: "7" }))).toBe("/volumes/7")
  })

  it("links articles and pages", () => {
    expect(internalDocToHref(linkTo("articles", { slug: "a" }))).toBe("/articles/a")
    expect(internalDocToHref(linkTo("pages", { slug: "home" }))).toBe("/")
  })

  it("throws when the document wasn't populated", () => {
    expect(() => internalDocToHref(linkTo("articles", 3))).toThrow()
  })
})
