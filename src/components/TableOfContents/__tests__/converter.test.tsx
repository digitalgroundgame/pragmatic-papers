import { fireEvent, render as renderDom, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

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

  it("names the heading and its self-link by the heading text", () => {
    const { heading: converter } = createTableOfContentsConverter()
    renderDom(
      <>
        {(converter as ConverterFn)({
          node: heading("h2", "My Section", "my-section"),
          nodesToJSX,
        })}
      </>,
    )
    // The link sits inside the heading, so neither name may pick up the other's text.
    expect(screen.getByRole("heading", { level: 2, name: "My Section" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "My Section" })).toHaveAttribute("href", "#my-section")
  })

  describe("heading text", () => {
    afterEach(() => {
      window.getSelection()?.removeAllRanges()
      window.location.hash = ""
    })

    function renderHeading() {
      const { heading: converter } = createTableOfContentsConverter()
      renderDom(
        <>
          {(converter as ConverterFn)({
            node: heading("h2", "My Section", "my-section"),
            nodesToJSX,
          })}
        </>,
      )
      return screen.getByText("My Section")
    }

    it("isn't inside the link, so it can be selected by dragging", () => {
      const text = renderHeading()
      expect(text.closest("a")).toBeNull()
      expect(screen.getByRole("link")).toHaveTextContent(/^$/)
    })

    it("links to the heading when clicked", () => {
      fireEvent.click(renderHeading())
      expect(window.location.hash).toBe("#my-section")
    })

    it("stays put when the click ends a selection", () => {
      const text = renderHeading()
      const range = document.createRange()
      range.selectNodeContents(text)
      window.getSelection()?.addRange(range)
      fireEvent.click(text)
      expect(window.location.hash).toBe("")
    })
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
