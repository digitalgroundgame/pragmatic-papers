// @vitest-environment node
import { articleContentBlocks, articleInlineBlocks } from "@/collections/Articles/contentBlocks"
import { editorsNoteBlocks } from "@/collections/Volumes/editorsNoteBlocks"
import { createHtmlConverters } from "@/utilities/generateRssFeed"
import {
  convertLexicalToHTML,
  defaultHTMLConverters,
  type HTMLConverters,
} from "@payloadcms/richtext-lexical/html"
import type { Block } from "payload"
import { describe, expect, it } from "vitest"

const PAGE_URL = "https://example.org/articles/test-article"

const converters = createHtmlConverters(PAGE_URL)({
  defaultConverters: defaultHTMLConverters,
}) as HTMLConverters

const slugs = (blocks: Block[]) => blocks.map(({ slug }) => slug)

/**
 * Every block a feed-rendered rich-text field allows needs an HTML converter,
 * or the feed prints "unknown node" in its place (#402, #1022). These read the
 * same block lists the collections register, so adding a block there without
 * a converter in `createHtmlConverters` fails here.
 */
describe("RSS feed converters cover every block", () => {
  it.each(slugs(articleContentBlocks))("feed.articles has a converter for block %s", (slug) => {
    expect(converters.blocks, `add a "${slug}" converter to createHtmlConverters`).toHaveProperty(
      slug,
    )
  })

  it.each(slugs(articleInlineBlocks))(
    "feed.articles has a converter for inline block %s",
    (slug) => {
      expect(
        converters.inlineBlocks,
        `add a "${slug}" inline converter to createHtmlConverters`,
      ).toHaveProperty(slug)
    },
  )

  it.each(slugs(editorsNoteBlocks))("feed.volumes has a converter for block %s", (slug) => {
    expect(converters.blocks, `add a "${slug}" converter to createHtmlConverters`).toHaveProperty(
      slug,
    )
  })
})

const text = (value: string) => ({ type: "text", text: value, format: 0, version: 1 })
const paragraph = (...children: unknown[]) => ({ type: "paragraph", children, version: 1 })
const block = (fields: Record<string, unknown>) => ({ type: "block", fields, version: 2 })

const render = (...children: unknown[]) =>
  convertLexicalToHTML({
    data: {
      root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
    } as never,
    converters: createHtmlConverters(PAGE_URL),
    disableContainer: true,
  })

describe("RSS feed block converters", () => {
  it("renders a banner's rich text inside a blockquote", () => {
    const html = render(
      block({
        blockType: "banner",
        style: "info",
        content: { root: { type: "root", children: [paragraph(text("Heads up"))], version: 1 } },
      }),
    )
    expect(html).toBe("<blockquote><p>Heads up</p></blockquote>")
  })

  it("renders code escaped inside pre/code", () => {
    expect(render(block({ blockType: "code", code: "<div>&</div>" }))).toBe(
      "<pre><code>&lt;div&gt;&amp;&lt;/div&gt;</code></pre>",
    )
  })

  it("renders a squiggle rule as a horizontal rule", () => {
    expect(render(block({ blockType: "squiggleRule" }))).toBe("<hr />")
  })

  it("links an interactive map back to the page it sits on", () => {
    expect(render(block({ blockType: "interactiveMap", widgetTitle: "Turnout" }))).toBe(
      `<p><a href="${PAGE_URL}">View the interactive map “Turnout” on The Pragmatic Papers</a></p>`,
    )
  })

  it("renders nothing, not 'unknown node', for a block without a converter", () => {
    expect(render(block({ blockType: "somethingNew" }))).toBe("")
  })
})
