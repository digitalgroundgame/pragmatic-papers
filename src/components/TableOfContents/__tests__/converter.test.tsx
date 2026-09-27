import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import { createTableOfContentsConverter, withTableOfContentsAnchors } from "../converter"

type ConverterFn = (args: { node: SerializedLexicalNode; nodesToJSX: unknown }) => React.ReactNode

const nodesToJSX = ({ nodes }: { nodes: unknown }): React.ReactNode[] =>
  ((nodes as { text?: string }[] | undefined) ?? []).map((n) => n.text ?? "")

function heading(tag: string, text: string, anchor?: string): SerializedHeadingNode {
  return {
    type: "heading",
    tag,
    anchor,
    children: [{ type: "text", text }],
  } as unknown as SerializedHeadingNode
}

function render(converter: unknown, node: SerializedLexicalNode): string {
  return renderToStaticMarkup(<>{(converter as ConverterFn)({ node, nodesToJSX })}</>)
}

describe("createTableOfContentsConverter", () => {
  it("renders the heading with its stored anchor as id and self-link", () => {
    const { heading: converter } = createTableOfContentsConverter()
    const html = render(converter, heading("h2", "My Section", "my-section"))
    expect(html).toContain('id="my-section"')
    expect(html).toContain("<h2")
    expect(html).toContain('href="#my-section"')
    expect(html).toContain("My Section")
  })

  it("renders a plain heading when the node has no anchor", () => {
    const { heading: converter } = createTableOfContentsConverter()
    const html = render(converter, heading("h3", "Orphan"))
    expect(html).not.toContain("id=")
    expect(html).not.toContain("href=")
    expect(html).toContain("<h3")
    expect(html).toContain("Orphan")
  })

  it("renders the supplied icon beside anchored headings", () => {
    const Icon = () => <svg data-testid="custom-icon" />
    const { heading: converter } = createTableOfContentsConverter(Icon)
    expect(render(converter, heading("h2", "Hi", "hi"))).toContain('data-testid="custom-icon"')
  })

  it("puts the table's stored anchor on its container", () => {
    const { table: converter } = createTableOfContentsConverter()
    const table = {
      type: "table",
      anchor: "table-1",
      children: [],
      version: 1,
    } as SerializedLexicalNode
    expect(render(converter, table)).toContain('<div id="table-1" class="lexical-table-container">')
  })
})

describe("withTableOfContentsAnchors", () => {
  const block = (anchor?: string) =>
    ({ type: "block", anchor, fields: { blockType: "map" }, version: 2 }) as SerializedLexicalNode

  it("wraps an anchored block in an element carrying the anchor", () => {
    const { map } = withTableOfContentsAnchors({ map: () => <figure>map</figure> })
    expect(render(map, block("election-map"))).toBe(
      '<div id="election-map"><figure>map</figure></div>',
    )
  })

  it("renders an unanchored block unchanged", () => {
    const { map } = withTableOfContentsAnchors({ map: () => <figure>map</figure> })
    expect(render(map, block())).toBe("<figure>map</figure>")
  })

  it("wraps a converter given as a plain element", () => {
    const { map } = withTableOfContentsAnchors({ map: <hr /> })
    expect(render(map, block("rule"))).toBe('<div id="rule"><hr/></div>')
  })
})
