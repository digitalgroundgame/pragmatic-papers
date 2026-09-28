// @vitest-environment node
import type { Article, Media } from "@/payload-types"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

beforeAll(() => {
  process.env.NEXT_PUBLIC_SERVER_URL = "https://example.org"
})

const { generateSubstackFeed, substackArticleHTML } = await import("../generateSubstackFeed")

const text = (value: string) => ({ type: "text", text: value, format: 0, version: 1 })
const paragraph = (...children: unknown[]) => ({ type: "paragraph", children, version: 1 })
const block = (fields: Record<string, unknown>) => ({ type: "block", fields, version: 2 })
const inlineBlock = (fields: Record<string, unknown>) => ({
  type: "inlineBlock",
  fields,
  version: 1,
})

const media = (overrides: Partial<Media> = {}): Media =>
  ({ id: 1, url: "/api/media/file/photo.jpg", alt: 'A "quoted" alt', ...overrides }) as Media

const makeArticle = (children: unknown[], overrides: Partial<Article> = {}): Article =>
  ({
    id: 1,
    title: "Test Article",
    slug: "test-article",
    _status: "published",
    publishedAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    createdAt: "2026-09-01T12:00:00.000Z",
    content: {
      root: {
        type: "root",
        children,
        direction: null,
        format: "",
        indent: 0,
        version: 1,
      },
    },
    ...overrides,
  }) as Article

describe("substackArticleHTML", () => {
  it("ends with a link back to the original article", () => {
    const html = substackArticleHTML(makeArticle([paragraph(text("Hello"))]))

    expect(html).toContain("<p>Hello</p>")
    expect(html).toMatch(
      /Originally published at <a href="https:\/\/example\.org\/articles\/test-article">The Pragmatic Papers<\/a>/,
    )
  })

  it("does not wrap the body in a payload-richtext container", () => {
    const html = substackArticleHTML(makeArticle([paragraph(text("Hello"))]))
    expect(html).not.toContain("payload-richtext")
  })

  it("puts the hero image first with an absolute, escaped src and alt", () => {
    const html = substackArticleHTML(makeArticle([paragraph(text("Body"))], { heroImage: media() }))

    expect(html.startsWith("<figure>")).toBe(true)
    expect(html).toContain('src="https://example.org/api/media/file/photo.jpg"')
    expect(html).toContain('alt="A &quot;quoted&quot; alt"')
  })

  it("keeps already-absolute media URLs", () => {
    const html = substackArticleHTML(
      makeArticle([
        block({ blockType: "mediaBlock", media: media({ url: "https://cdn.test/a.png" }) }),
      ]),
    )
    expect(html).toContain('src="https://cdn.test/a.png"')
  })

  it("renders footnotes in Substack's own footnote markup", () => {
    const html = substackArticleHTML(
      makeArticle(
        [paragraph(text("Claim"), inlineBlock({ blockType: "footnote", index: 1, note: "n" }))],
        {
          footnotes: [
            {
              index: 1,
              note: "A <source> note",
              attributionEnabled: true,
              link: { type: "custom", url: "https://source.test", label: "Source" },
            },
          ],
        },
      ),
    )

    expect(html).toContain(
      'Claim<a data-component-name="FootnoteAnchorToDOM" id="footnote-anchor-1" href="#footnote-1" target="_self" class="footnote-anchor">1</a>',
    )
    expect(html).toContain(
      '<div data-component-name="FootnoteToDOM" class="footnote"><a id="footnote-1" href="#footnote-anchor-1" contenteditable="false" target="_self" class="footnote-number">1</a><div class="footnote-content"><p>A &lt;source&gt; note <a href="https://source.test">Source</a></p></div></div>',
    )
  })

  it("puts the footnotes last, after the link back to the article", () => {
    const html = substackArticleHTML(
      makeArticle(
        [paragraph(text("Claim"), inlineBlock({ blockType: "footnote", index: 1, note: "n" }))],
        {
          footnotes: [{ index: 1, note: "n", attributionEnabled: false }],
        },
      ),
    )
    expect(html.indexOf("Originally published")).toBeLessThan(html.indexOf("FootnoteToDOM"))
    expect(html.endsWith("</div></div>")).toBe(true)
  })

  it("falls back to LaTeX source for math", () => {
    const html = substackArticleHTML(
      makeArticle([
        paragraph(inlineBlock({ blockType: "inlineMathBlock", math: "a<b" })),
        block({ blockType: "displayMathBlock", math: "x^2" }),
      ]),
    )

    expect(html).toContain("<code>a&lt;b</code>")
    expect(html).toContain("<pre><code>x^2</code></pre>")
  })

  it("links interactive maps back to the article", () => {
    const html = substackArticleHTML(
      makeArticle([block({ blockType: "interactiveMap", widgetTitle: "Turnout" })]),
    )
    expect(html).toContain(
      '<a href="https://example.org/articles/test-article">View the interactive map “Turnout” on The Pragmatic Papers →</a>',
    )
  })

  it("renders banners, code and squiggle rules as plain HTML", () => {
    const html = substackArticleHTML(
      makeArticle([
        block({
          blockType: "banner",
          style: "info",
          content: { root: { type: "root", children: [paragraph(text("Heads up"))], version: 1 } },
        }),
        block({ blockType: "code", code: "<div>" }),
        block({ blockType: "squiggleRule" }),
      ]),
    )

    expect(html).toContain("<blockquote><p>Heads up</p></blockquote>")
    expect(html).toContain("<pre><code>&lt;div&gt;</code></pre>")
    expect(html).toContain("<hr />")
  })

  it("drops blocks it has no converter for instead of printing 'unknown node'", () => {
    const html = substackArticleHTML(makeArticle([block({ blockType: "somethingNew" })]))
    expect(html).not.toContain("unknown node")
  })

  it("makes internal links absolute", () => {
    const html = substackArticleHTML(
      makeArticle([
        paragraph({
          type: "link",
          version: 3,
          fields: {
            linkType: "internal",
            doc: { relationTo: "articles", value: { slug: "other" } },
          },
          children: [text("other piece")],
        }),
      ]),
    )
    expect(html).toContain('href="https://example.org/articles/other"')
  })

  it("uses no inline styles in its own markup", () => {
    const html = substackArticleHTML(
      makeArticle(
        [block({ blockType: "mediaCollage", images: [{ media: media() }, { media: media() }] })],
        {
          footnotes: [{ index: 1, note: "n", attributionEnabled: false }],
        },
      ),
    )
    expect(html).not.toContain("style=")
  })
})

describe("substackArticleHTML block and node coverage", () => {
  const richText = (...children: unknown[]) => ({
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  })

  it("renders a timeline with escaped text and absolute citation links", () => {
    const html = substackArticleHTML(
      makeArticle([
        block({
          blockType: "timeline",
          title: "Key <dates>",
          events: [
            {
              date: "2024-03-12",
              title: "Bill introduced",
              description: "Filed & referred",
              enableCitation: true,
              citation: { type: "custom", url: "https://source.test/a" },
            },
            {
              date: "2024-04-01",
              description: "Passed committee",
              enableCitation: true,
              citation: {
                type: "reference",
                reference: { relationTo: "articles", value: { slug: "other" } },
              },
            },
            { date: "2024-05-01", description: "No source", enableCitation: false },
          ],
        }),
      ]),
    )

    expect(html).toContain("<h3>Key &lt;dates&gt;</h3>")
    expect(html).toContain(
      '<li><strong>2024-03-12</strong> — <strong>Bill introduced</strong><br />Filed &amp; referred <a href="https://source.test/a">[source]</a></li>',
    )
    expect(html).toContain('<a href="https://example.org/articles/other">[source]</a>')
    expect(html).toContain("<li><strong>2024-05-01</strong><br />No source</li>")
  })

  it("renders nothing for a timeline without events", () => {
    const html = substackArticleHTML(makeArticle([block({ blockType: "timeline", events: [] })]))
    expect(html).not.toContain("<ul>")
  })

  it("renders an uploaded image as a figure and drops non-image uploads", () => {
    const upload = (value: Partial<Media>) => ({
      type: "upload",
      relationTo: "media",
      value: media(value),
      fields: {},
      version: 3,
    })
    const html = substackArticleHTML(
      makeArticle([
        upload({ mimeType: "image/png", url: "/api/media/file/chart.png", alt: "Chart" }),
        upload({ mimeType: "application/pdf", url: "/api/media/file/report.pdf" }),
      ]),
    )

    expect(html).toContain(
      '<figure><img src="https://example.org/api/media/file/chart.png" alt="Chart" /></figure>',
    )
    expect(html).not.toContain("report.pdf")
  })

  it("includes a media caption as a figcaption", () => {
    const html = substackArticleHTML(
      makeArticle([
        block({
          blockType: "mediaBlock",
          media: media({ caption: richText(paragraph(text("Photo: AP"))) as Media["caption"] }),
        }),
      ]),
    )
    expect(html).toContain("<figcaption><p>Photo: AP</p></figcaption>")
  })

  it("links social embeds instead of embedding them", () => {
    const html = substackArticleHTML(
      makeArticle([
        block({
          blockType: "socialEmbed",
          url: "https://bsky.app/profile/x/post/1",
          platform: "bluesky",
        }),
      ]),
    )
    expect(html).toContain('href="https://bsky.app/profile/x/post/1"')
  })

  it("falls back to the article's URL for an internal link whose target isn't loaded", () => {
    const html = substackArticleHTML(
      makeArticle([
        paragraph({
          type: "link",
          version: 3,
          fields: { linkType: "internal", doc: { relationTo: "articles", value: 42 } },
          children: [text("unresolved")],
        }),
      ]),
    )
    expect(html).toContain('href="https://example.org/articles/test-article"')
  })

  it("numbers footnotes by where they're referenced, not by their index", () => {
    const html = substackArticleHTML(
      makeArticle(
        [
          paragraph(
            text("A"),
            inlineBlock({ blockType: "footnote", index: 2, note: "Second note" }),
            text("B"),
            inlineBlock({ blockType: "footnote", index: 1, note: "First note" }),
          ),
        ],
        {
          footnotes: [
            { index: 1, note: "First note", attributionEnabled: false },
            { index: 2, note: "Second note", attributionEnabled: false },
          ],
        },
      ),
    )

    expect(html).toMatch(
      /A<a [^>]*id="footnote-anchor-1"[^>]*>1<\/a>B<a [^>]*id="footnote-anchor-2"/,
    )
    expect(html).toContain(
      'class="footnote-number">1</a><div class="footnote-content"><p>Second note</p>',
    )
    expect(html).toContain(
      'class="footnote-number">2</a><div class="footnote-content"><p>First note</p>',
    )
  })

  it("repeats a note cited twice, since a Substack footnote has one reference", () => {
    const html = substackArticleHTML(
      makeArticle(
        [
          paragraph(
            inlineBlock({ blockType: "footnote", index: 1, note: "Shared" }),
            inlineBlock({ blockType: "footnote", index: 1, note: "Shared" }),
          ),
        ],
        { footnotes: [{ index: 1, note: "Shared", attributionEnabled: false }] },
      ),
    )

    expect(html.match(/FootnoteAnchorToDOM/g)).toHaveLength(2)
    expect(html.match(/<p>Shared<\/p>/g)).toHaveLength(2)
    expect(html).toContain('id="footnote-2"')
  })

  it("uses the reference's own note when the footnotes list lacks it", () => {
    const html = substackArticleHTML(
      makeArticle([
        paragraph(inlineBlock({ blockType: "footnote", index: 7, note: "Inline only" })),
      ]),
    )
    expect(html).toContain('<div class="footnote-content"><p>Inline only</p></div>')
  })

  it("leaves out footnotes nothing in the body refers to", () => {
    const html = substackArticleHTML(
      makeArticle([paragraph(text("Body"))], {
        footnotes: [{ index: 1, note: "Orphan", attributionEnabled: false }],
      }),
    )
    expect(html).not.toContain("Orphan")
  })
})

describe("substackArticleHTML formatting, lists and tables", () => {
  const formatted = (value: string, format: number) => ({ ...text(value), format })
  const item = (children: unknown[], extra: Record<string, unknown> = {}) => ({
    type: "listitem",
    version: 1,
    value: 1,
    children,
    ...extra,
  })
  const list = (listType: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
    type: "list",
    version: 1,
    listType,
    start: 1,
    tag: listType === "number" ? "ol" : "ul",
    children,
    ...extra,
  })
  const cell = (value: string, headerState = 0, extra: Record<string, unknown> = {}) => ({
    type: "tablecell",
    version: 1,
    headerState,
    children: [paragraph(text(value))],
    ...extra,
  })
  const row = (...cells: unknown[]) => ({ type: "tablerow", version: 1, children: cells })

  it("uses plain tags for every text format", () => {
    const html = substackArticleHTML(
      makeArticle([
        paragraph(
          formatted("b", 1),
          formatted("i", 2),
          formatted("s", 4),
          formatted("u", 8),
          formatted("c", 16),
          formatted("sub", 32),
          formatted("sup", 64),
          formatted("both <&>", 1 | 2),
        ),
      ]),
    )
    expect(html).toContain(
      "<p><strong>b</strong><em>i</em><s>s</s><u>u</u><code>c</code><sub>sub</sub><sup>sup</sup><em><strong>both &lt;&amp;&gt;</strong></em></p>",
    )
  })

  it("renders lists without attributes, keeping a numbered list's start", () => {
    const html = substackArticleHTML(
      makeArticle([
        list("number", [item([text("Three")]), item([text("Four")])], { start: 3 }),
        list("bullet", [item([text("Dot")])]),
      ]),
    )
    expect(html).toContain('<ol start="3"><li>Three</li><li>Four</li></ol>')
    expect(html).toContain("<ul><li>Dot</li></ul>")
  })

  it("attaches a nested list to the item before it instead of adding an empty bullet", () => {
    const html = substackArticleHTML(
      makeArticle([
        list("bullet", [
          item([text("Parent")]),
          item([list("bullet", [item([text("Child")])])]),
          item([text("Sibling")]),
        ]),
      ]),
    )
    expect(html).toContain("<ul><li>Parent<ul><li>Child</li></ul></li><li>Sibling</li></ul>")
  })

  it("renders a checklist as text markers, not form inputs", () => {
    const html = substackArticleHTML(
      makeArticle([
        list("check", [
          item([text("Done")], { checked: true }),
          item([text("To do")], { checked: false }),
        ]),
      ]),
    )
    expect(html).toContain("<ul><li>☑ Done</li><li>☐ To do</li></ul>")
  })

  it("renders a plain table with header cells and spans", () => {
    const html = substackArticleHTML(
      makeArticle([
        {
          type: "table",
          version: 1,
          children: [
            row(cell("Format", 1), cell("Use", 1)),
            row(cell("Bold", 0, { colSpan: 2 })),
            row(cell("Tall", 0, { rowSpan: 2 }), cell("Short")),
          ],
        },
      ]),
    )
    expect(html).toContain(
      "<table><tr><th><p>Format</p></th><th><p>Use</p></th></tr>" +
        '<tr><td colspan="2"><p>Bold</p></td></tr>' +
        '<tr><td rowspan="2"><p>Tall</p></td><td><p>Short</p></td></tr></table>',
    )
  })
})

describe("generateSubstackFeed", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("skips an article whose conversion throws and keeps the rest", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const broken = makeArticle([paragraph(text("Broken"))], { slug: "broken" })
    Object.defineProperty(broken, "heroImage", {
      get: () => {
        throw new Error("boom")
      },
    })

    const xml = generateSubstackFeed([broken, makeArticle([paragraph(text("Fine"))])])

    expect(xml).not.toContain("/articles/broken")
    expect(xml).toContain("<p>Fine</p>")
    expect(error).toHaveBeenCalledWith(
      "Error converting article broken for Substack:",
      expect.any(Error),
    )
  })

  it("emits RSS 2.0 with the full post in content:encoded", () => {
    const xml = generateSubstackFeed([
      makeArticle([paragraph(text("Body text"))], {
        meta: { description: "The subtitle" },
        authors: [{ id: 7, name: "Ada Lovelace" } as never],
      }),
    ])

    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain("<title><![CDATA[Test Article]]></title>")
    expect(xml).toContain("<link>https://example.org/articles/test-article</link>")
    expect(xml).toContain("<description><![CDATA[The subtitle]]></description>")
    expect(xml).toMatch(/<content:encoded><!\[CDATA\[.*<p>Body text<\/p>/s)
    expect(xml).toContain("Ada Lovelace")
  })

  it("skips drafts and articles without a publish date", () => {
    const xml = generateSubstackFeed([
      makeArticle([paragraph(text("draft"))], { _status: "draft", slug: "draft" }),
      makeArticle([paragraph(text("undated"))], { publishedAt: null, slug: "undated" }),
    ])

    expect(xml).not.toContain("<item>")
  })
})
