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

  it("keeps a footnote's note out of its marker, so nothing there to escape", () => {
    const html = renderContent(
      paragraph(
        inlineBlock({ blockType: "footnote", index: 1, note: 'He said "<b>no</b>" & left' }),
      ),
    )
    expect(html).toBe("<p><sup>[1]</sup></p>")
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

const entries = (xml: string) => xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []

describe("generateArticleFeed", () => {
  it("is a valid Atom feed with the site's metadata and its own URL", () => {
    const feed = generateArticleFeed([])

    expect(feed).toMatch(/^<\?xml version="1.0" encoding="utf-8"\?>/)
    expect(feed).toContain('<feed xmlns="http://www.w3.org/2005/Atom">')
    expect(feed).toContain("<title>The Pragmatic Papers - Articles</title>")
    expect(feed).toContain("<id>https://example.org</id>")
    expect(feed).toContain('<link rel="self" href="https://example.org/articles/feed.xml"/>')
  })

  it("has no entries for no articles", () => {
    expect(entries(generateArticleFeed([]))).toEqual([])
  })

  it("adds an entry per published article with its title, link, dates and authors", () => {
    const feed = generateArticleFeed([
      makeArticle([paragraph(text("Body text"))], {
        authors: [
          { id: 1, name: "Ada Lovelace" } as never,
          { id: 2, name: "Alan Turing" } as never,
        ],
        meta: { description: "A summary" },
      }),
    ])
    const [entry] = entries(feed)

    expect(entries(feed)).toHaveLength(1)
    expect(entry).toContain('<title type="html"><![CDATA[Test Article]]></title>')
    expect(entry).toContain("<id>https://example.org/articles/test-article</id>")
    expect(entry).toContain('<link href="https://example.org/articles/test-article"/>')
    expect(entry).toContain("<published>2026-09-01T12:00:00.000Z</published>")
    expect(entry).toContain('<summary type="html"><![CDATA[A summary]]></summary>')
    expect(entry).toContain("<name>Ada Lovelace</name>")
    expect(entry).toContain("<name>Alan Turing</name>")
    expect(entry).toContain("<p>Body text</p>")
  })

  it("skips drafts and articles without a publish date", () => {
    const feed = generateArticleFeed([
      makeArticle([], { slug: "draft", _status: "draft" }),
      makeArticle([], { slug: "undated", publishedAt: null }),
      makeArticle([], { slug: "live" }),
    ])

    expect(entries(feed)).toHaveLength(1)
    expect(feed).toContain("https://example.org/articles/live")
  })

  it("handles an article with no authors, description, image, content or footnotes", () => {
    const feed = generateArticleFeed([
      makeArticle([], {
        authors: undefined,
        meta: undefined,
        content: undefined as never,
        footnotes: undefined,
      }),
    ])
    const [entry] = entries(feed)

    expect(entry).toBeDefined()
    expect(entry).not.toContain("<author>")
    expect(entry).not.toContain("<h3>Notes</h3>")
  })

  it("leaves out authors that weren't loaded", () => {
    const feed = generateArticleFeed([makeArticle([], { authors: [7] })])
    expect(entries(feed)[0]).not.toContain("<author>")
  })

  it("uses the SEO image, made absolute", () => {
    const feed = generateArticleFeed([
      makeArticle([], { meta: { image: { id: 1, url: "/api/media/file/hero.jpg" } as never } }),
    ])
    expect(feed).toContain("https://example.org/api/media/file/hero.jpg")
  })

  it("lists the article's notes after its content, without in-page anchors", () => {
    const feed = generateArticleFeed([
      makeArticle([paragraph(text("Body"), inlineBlock({ blockType: "footnote", index: 1 }))], {
        footnotes: [
          {
            id: "1",
            index: 1,
            note: "A source",
            attributionEnabled: true,
            link: { type: "custom", url: "https://source.test/a" },
          },
        ],
      }),
    ])
    const entry = entries(feed)[0] ?? ""

    expect(entry).toContain("<p>Body<sup>[1]</sup></p>")
    expect(entry.indexOf("<p>Body")).toBeLessThan(entry.indexOf("<h3>Notes</h3>"))
    expect(entry).toContain(
      '<p>[1] A source <a href="https://source.test/a">https://source.test/a</a></p>',
    )
    expect(entry).not.toContain("#footnote")
  })
})

describe("generateVolumeFeed", () => {
  it("is an Atom feed for volumes with its own URL", () => {
    const feed = generateVolumeFeed([])

    expect(feed).toContain("<title>The Pragmatic Papers - Volumes</title>")
    expect(feed).toContain('<link rel="self" href="https://example.org/volumes/feed.xml"/>')
    expect(entries(feed)).toEqual([])
  })

  it("adds an entry per published volume with its description and article list", () => {
    const feed = generateVolumeFeed([
      makeVolume({
        articles: [
          makeArticle([], {
            slug: "first",
            title: "First Piece",
            authors: [{ id: 1, name: "Ada Lovelace" } as never],
          }),
          makeArticle([], { slug: "second", title: "Second Piece" }),
        ],
      }),
    ])
    const [entry] = entries(feed)

    expect(entries(feed)).toHaveLength(1)
    expect(entry).toContain("<id>https://example.org/volumes/1</id>")
    expect(entry).toContain("The first volume")
    expect(entry).toContain("Articles in this Volume")
    expect(entry).toContain('<a href="https://example.org/articles/first">First Piece</a>')
    expect(entry).toContain('<a href="https://example.org/articles/second">Second Piece</a>')
    expect(entry).toContain("<name>Ada Lovelace</name>")
  })

  it("renders the editor's note", () => {
    const feed = generateVolumeFeed([
      makeVolume({ editorsNote: richText([paragraph(text("From the editor"))]) as never }),
    ])
    expect(feed).toContain("<p>From the editor</p>")
  })

  it("skips drafts", () => {
    expect(entries(generateVolumeFeed([makeVolume({ _status: "draft" })]))).toEqual([])
  })

  it("leaves out articles that weren't loaded instead of linking to /articles/undefined", () => {
    const feed = generateVolumeFeed([makeVolume({ articles: [3] })])

    expect(feed).not.toContain("undefined")
    expect(feed).not.toContain("Articles in this Volume")
  })

  it("handles a volume with no articles, editor's note or SEO fields", () => {
    const feed = generateVolumeFeed([
      makeVolume({ articles: undefined, editorsNote: undefined, meta: undefined }),
    ])
    const [entry] = entries(feed)

    expect(entry).toBeDefined()
    expect(entry).not.toContain("<author>")
  })
})
