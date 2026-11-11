import { fireEvent, render as renderDom, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"
import { MULTI_CLICK_WAIT_MS } from "../AnchoredHeading"
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
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
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

    it("labels itself without taking another heading's anchor", () => {
      const { heading: converter } = createTableOfContentsConverter()
      const { container } = renderDom(
        <>
          {(converter as ConverterFn)({
            node: heading("h2", "Background", "background"),
            nodesToJSX,
          })}
          {(converter as ConverterFn)({
            node: heading("h2", "Background text", "background-text"),
            nodesToJSX,
          })}
        </>,
      )
      expect(container.querySelectorAll("#background-text")).toHaveLength(1)
      expect(screen.getByRole("heading", { name: "Background" })).toBeInTheDocument()
      expect(screen.getByRole("heading", { name: "Background text" })).toHaveAttribute(
        "id",
        "background-text",
      )
    })

    it("links to the heading when clicked", () => {
      fireEvent.click(renderHeading(), { detail: 1 })
      // It waits to see whether this is the first click of a double click.
      expect(window.location.hash).toBe("")
      vi.advanceTimersByTime(MULTI_CLICK_WAIT_MS)
      expect(window.location.hash).toBe("#my-section")
    })

    it("stays put when a double click selects a word", () => {
      const text = renderHeading()
      fireEvent.click(text, { detail: 1 })
      // The second click selects the word under it.
      const range = document.createRange()
      range.setStart(text.firstChild!, 0)
      range.setEnd(text.firstChild!, 2)
      window.getSelection()?.addRange(range)
      fireEvent.click(text, { detail: 2 })
      vi.advanceTimersByTime(MULTI_CLICK_WAIT_MS)
      expect(window.location.hash).toBe("")
    })

    it("stays put when the click ends a selection", () => {
      const text = renderHeading()
      const range = document.createRange()
      range.selectNodeContents(text)
      window.getSelection()?.addRange(range)
      fireEvent.click(text, { detail: 1 })
      vi.advanceTimersByTime(MULTI_CLICK_WAIT_MS)
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
