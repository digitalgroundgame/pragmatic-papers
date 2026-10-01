// @vitest-environment node
import type { Article } from "@/payload-types"
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html"
import { beforeAll, describe, expect, it } from "vitest"

beforeAll(() => {
  process.env.SERVER_URL = "https://example.org"
})

// Imported after SERVER_URL is set: the module reads it once, on load.
const { createHtmlConverters } = await import("../generateRssFeed")

const PAGE_URL = "https://example.org/articles/test-article"

const text = (value: string) => ({ type: "text", text: value, format: 0, version: 1 })
const paragraph = (...children: unknown[]) => ({ type: "paragraph", children, version: 1 })

const renderContent = (...children: unknown[]) =>
  convertLexicalToHTML({
    data: {
      root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
    } as Article["content"],
    converters: createHtmlConverters(PAGE_URL),
    disableContainer: true,
  })

const internalLink = (doc: { relationTo: string; value: unknown }) => ({
  type: "link",
  version: 3,
  fields: { linkType: "internal", doc },
  children: [text("linked")],
})

describe("RSS feed links", () => {
  it("makes an internal link to an article absolute", () => {
    const html = renderContent(
      paragraph(internalLink({ relationTo: "articles", value: { slug: "other" } })),
    )
    expect(html).toContain('href="https://example.org/articles/other"')
  })

  it("makes an internal link to a page absolute", () => {
    const html = renderContent(
      paragraph(internalLink({ relationTo: "pages", value: { slug: "about" } })),
    )
    expect(html).toContain('href="https://example.org/about"')
  })

  it("falls back to the page's URL when the linked document isn't loaded", () => {
    const html = renderContent(paragraph(internalLink({ relationTo: "articles", value: 42 })))
    expect(html).toContain(`href="${PAGE_URL}"`)
    expect(html).not.toContain('href="#"')
  })

  it("keeps a custom link's URL", () => {
    const html = renderContent(
      paragraph({
        type: "link",
        version: 3,
        fields: { linkType: "custom", url: "https://source.test/a" },
        children: [text("source")],
      }),
    )
    expect(html).toContain('href="https://source.test/a"')
  })
})
