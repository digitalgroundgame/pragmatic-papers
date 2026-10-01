// @vitest-environment node
import type { Article, Volume } from "@/payload-types"
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html"
import { beforeAll, describe, expect, it } from "vitest"

beforeAll(() => {
  process.env.SERVER_URL = "https://example.org"
})

// Imported after SERVER_URL is set: the module reads it once, on load.
const { createHtmlConverters, generateArticleFeed, generateVolumeFeed } =
  await import("../generateRssFeed")

const PAGE_URL = "https://example.org/articles/test-article"

const text = (value: string) => ({ type: "text", text: value, format: 0, version: 1 })
const paragraph = (...children: unknown[]) => ({ type: "paragraph", children, version: 1 })

const richText = (children: unknown[]) =>
  ({
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  }) as Article["content"]

const makeArticle = (children: unknown[], overrides: Partial<Article> = {}): Article =>
  ({
    id: 1,
    title: "Test Article",
    slug: "test-article",
    _status: "published",
    publishedAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z",
    createdAt: "2026-09-01T12:00:00.000Z",
    content: richText(children),
    ...overrides,
  }) as Article

const makeVolume = (overrides: Partial<Volume> = {}): Volume =>
  ({
    id: 1,
    title: "Volume One",
    slug: "1",
    volumeNumber: 1,
    description: "The first volume",
    _status: "published",
    publishedAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z",
    createdAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  }) as Volume

const renderContent = (...children: unknown[]) =>
  convertLexicalToHTML({
    data: richText(children),
    converters: createHtmlConverters(PAGE_URL),
    disableContainer: true,
  })

const internalLink = (doc: { relationTo: string; value: unknown }) => ({
  type: "link",
  version: 3,
  fields: { linkType: "internal", doc },
  children: [text("linked")],
})

const block = (fields: Record<string, unknown>) => ({ type: "block", fields, version: 2 })
const inlineBlock = (fields: Record<string, unknown>) => ({
  type: "inlineBlock",
  fields,
  version: 1,
})

describe("RSS feed escapes CMS text (#1024)", () => {
  it("escapes a quoted alt text in a media block", () => {
    const html = renderContent(
      block({
        blockType: "mediaBlock",
        media: { id: 1, url: "/api/media/file/a.jpg", alt: 'A "quoted" <alt>' },
      }),
    )
    expect(html).toContain('alt="A &quot;quoted&quot; &lt;alt&gt;"')
  })

  it("escapes alt text in a media collage", () => {
    const html = renderContent(
      block({
        blockType: "mediaCollage",
        images: [{ media: { id: 1, url: "/a.jpg", alt: 'Say "hi"' } }],
      }),
    )
    expect(html).toContain('alt="Say &quot;hi&quot;"')
  })

  it("escapes a timeline's title, date, event title and description", () => {
    const html = renderContent(
      block({
        blockType: "timeline",
        title: "R&D <timeline>",
        events: [{ date: "<2024>", title: "A & B", description: "x < y", enableCitation: false }],
      }),
    )
    expect(html).toContain("R&amp;D &lt;timeline&gt;")
    expect(html).toContain("&lt;2024&gt;")
    expect(html).toContain("A &amp; B")
    expect(html).toContain("x &lt; y")
    expect(html).not.toContain("<timeline>")
  })

  it("escapes a footnote note inside its title attribute", () => {
    const html = renderContent(
      paragraph(
        inlineBlock({ blockType: "footnote", index: 1, note: 'He said "<b>no</b>" & left' }),
      ),
    )
    expect(html).toContain(
      'title="Footnote 1: He said &quot;&lt;b&gt;no&lt;/b&gt;&quot; &amp; left"',
    )
  })

  it("escapes math", () => {
    expect(renderContent(block({ blockType: "displayMathBlock", math: "a<b" }))).toContain(
      "\\[a&lt;b\\]",
    )
  })

  it("escapes footnote text in the article's footnote list", () => {
    const feed = generateArticleFeed([
      makeArticle([paragraph(text("Body"))], {
        footnotes: [{ id: "1", index: 1, note: "Tom & Jerry <3", attributionEnabled: false }],
      }),
    ])
    expect(feed).toContain("Tom &amp; Jerry &lt;3")
  })

  it("escapes article titles and descriptions in a volume's article list", () => {
    const feed = generateVolumeFeed([
      makeVolume({
        articles: [
          makeArticle([], { title: "Cats & <Dogs>", meta: { description: 'A "fine" read' } }),
        ],
      }),
    ])
    expect(feed).toContain("Cats &amp; &lt;Dogs&gt;")
    expect(feed).toContain("A &quot;fine&quot; read")
  })

  it("escapes a social embed's URL", () => {
    const html = renderContent(
      block({ blockType: "socialEmbed", url: 'https://x.test/"onmouseover=', platform: "twitter" }),
    )
    expect(html).toContain('href="https://x.test/&quot;onmouseover="')
  })
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
