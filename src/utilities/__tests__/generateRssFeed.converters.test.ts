// @vitest-environment node
import configPromise from "@payload-config"
import { createSubstackConverters } from "@/app/(frontend)/articles/_substack/generateSubstackFeed"
import { createHtmlConverters } from "@/utilities/generateRssFeed"
import {
  convertLexicalToHTML,
  defaultHTMLConverters,
  type HTMLConverters,
} from "@payloadcms/richtext-lexical/html"
import type { SanitizedConfig } from "payload"
import { beforeAll, describe, expect, it } from "vitest"

const PAGE_URL = "https://example.org/articles/test-article"

const resolve = (factory: typeof createHtmlConverters) =>
  factory(PAGE_URL)({ defaultConverters: defaultHTMLConverters }) as HTMLConverters

const rssConverters = resolve(createHtmlConverters)

/** The rich-text fields each feed renders, and the converters it renders them with. */
const FEED_FIELDS = [
  {
    feed: "articles/feed.xml",
    collection: "articles",
    field: "content",
    converters: rssConverters,
    factory: "createHtmlConverters",
  },
  {
    feed: "volumes/feed.xml",
    collection: "volumes",
    field: "editorsNote",
    converters: rssConverters,
    factory: "createHtmlConverters",
  },
  {
    feed: "articles/substack.xml",
    collection: "articles",
    field: "content",
    converters: resolve(createSubstackConverters),
    factory: "createSubstackConverters",
  },
] as const

/** Node types Lexical registers itself, outside any feature. */
const CORE_NODE_TYPES = ["paragraph", "text", "linebreak", "tab"]

// The slice of Payload's sanitized config this test reads.
interface ResolvedFeature {
  nodes?: { node: { getType: () => string } }[]
  sanitizedServerFeatureProps?: { blocks?: ResolvedBlock[]; inlineBlocks?: ResolvedBlock[] }
}
interface ResolvedBlock {
  slug: string
  fields?: ResolvedField[]
  flattenedFields?: ResolvedField[]
}
interface ResolvedField {
  name?: string
  type: string
  fields?: ResolvedField[]
  flattenedFields?: ResolvedField[]
  blocks?: ResolvedBlock[]
  editor?: { editorConfig?: { resolvedFeatureMap?: Map<string, ResolvedFeature> } }
}

interface Coverage {
  nodeTypes: Set<string>
  blocks: Set<string>
  inlineBlocks: Set<string>
}

const fieldsOf = (item: { fields?: ResolvedField[]; flattenedFields?: ResolvedField[] }) =>
  item.flattenedFields ?? item.fields ?? []

/**
 * Collect every node type, block and inline block the given fields' rich text
 * can produce, including the rich text nested inside blocks (a banner's
 * content), which the feed renders through the same converters.
 */
const collect = (fields: ResolvedField[], coverage: Coverage): void => {
  for (const field of fields) {
    const features =
      field.type === "richText" ? field.editor?.editorConfig?.resolvedFeatureMap : undefined
    for (const feature of features?.values() ?? []) {
      for (const { node } of feature.nodes ?? []) coverage.nodeTypes.add(node.getType())
    }
    const { blocks = [], inlineBlocks = [] } =
      features?.get("blocks")?.sanitizedServerFeatureProps ?? {}
    blocks.forEach(({ slug }) => coverage.blocks.add(slug))
    inlineBlocks.forEach(({ slug }) => coverage.inlineBlocks.add(slug))

    const nested = [...blocks, ...inlineBlocks, ...(field.blocks ?? [])]
    collect([...fieldsOf(field), ...nested.flatMap(fieldsOf)], coverage)
  }
}

/**
 * Every node type and block a feed-rendered rich-text field allows needs an
 * HTML converter, or the feed prints "unknown node" in its place (#402,
 * #1022). This reads the resolved Payload config, the same one the admin
 * editor uses, so enabling a feature or adding a block anywhere those fields
 * reach fails here until every feed's converter factory handles it.
 */
describe.each(FEED_FIELDS)("$feed renders every node in $collection.$field", (target) => {
  const coverage: Coverage = { nodeTypes: new Set(), blocks: new Set(), inlineBlocks: new Set() }

  beforeAll(async () => {
    const config: SanitizedConfig = await configPromise
    const collection = config.collections.find(({ slug }) => slug === target.collection)
    const field = (collection?.flattenedFields as ResolvedField[] | undefined)?.find(
      ({ name }) => name === target.field,
    )
    if (!field) throw new Error(`${target.collection}.${target.field} not found in the config`)
    collect([field], coverage)
    CORE_NODE_TYPES.forEach((type) => coverage.nodeTypes.add(type))
  }, 60_000)

  it("finds the field's blocks in the config", () => {
    // Guards the traversal itself: an empty set would make every check below pass.
    expect(coverage.blocks.size).toBeGreaterThan(0)
  })

  it("has a converter for every node type", () => {
    const missing = [...coverage.nodeTypes].filter(
      (type) => type !== "block" && type !== "inlineBlock" && !(type in target.converters),
    )
    expect(missing, `add converters for these node types to ${target.factory}`).toEqual([])
  })

  it("has a converter for every block", () => {
    const missing = [...coverage.blocks].filter((slug) => !target.converters.blocks?.[slug])
    expect(missing, `add converters for these blocks to ${target.factory}`).toEqual([])
  })

  it("has a converter for every inline block", () => {
    const missing = [...coverage.inlineBlocks].filter(
      (slug) => !target.converters.inlineBlocks?.[slug],
    )
    expect(missing, `add converters for these inline blocks to ${target.factory}`).toEqual([])
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
})

describe("RSS feed fallback for nodes without a converter", () => {
  it("renders nothing, not 'unknown node', for a block", () => {
    expect(render(block({ blockType: "somethingNew" }))).toBe("")
  })

  it("keeps the text of an unknown element node", () => {
    expect(render({ type: "somethingNew", version: 1, children: [paragraph(text("kept"))] })).toBe(
      "<p>kept</p>",
    )
  })

  it("renders nothing for an unknown leaf node", () => {
    expect(render({ type: "somethingNew", version: 1 })).toBe("")
  })
})
