// @vitest-environment node
import type { Article, Media } from "@/payload-types"
import { beforeAll, describe, expect, it } from "vitest"

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

  it("renders footnotes as plain markers and a Notes section without anchors", () => {
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

    expect(html).toContain("Claim<sup>[1]</sup>")
    expect(html).toContain("<h3>Notes</h3>")
    expect(html).toContain(
      '<p>[1] A &lt;source&gt; note <a href="https://source.test">Source</a></p>',
    )
    expect(html).not.toContain("#footnote")
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

describe("generateSubstackFeed", () => {
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
