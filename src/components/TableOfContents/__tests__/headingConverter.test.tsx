import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { DefaultTypedEditorState, SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import { createTableOfContentsConverter } from "../headingConverter"

type ConverterFn = (args: { node: SerializedHeadingNode; nodesToJSX: unknown }) => React.ReactNode

function makeState(children: unknown[]): DefaultTypedEditorState {
  return {
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as DefaultTypedEditorState
}

const nodesToJSX = ({ nodes }: { nodes: unknown }): React.ReactNode[] =>
  ((nodes as { text?: string }[] | undefined) ?? []).map((n) => n.text ?? "")

function invoke(
  converter: ReturnType<typeof createTableOfContentsConverter>["heading"],
  node: SerializedHeadingNode,
): React.ReactNode {
  return (converter as unknown as ConverterFn)({ node, nodesToJSX })
}

describe("createHeadingConverter", () => {
  it("renders the heading with an id matching the slugified text", () => {
    const heading = {
      type: "heading",
      tag: "h2",
      children: [{ type: "text", text: "My Section" }],
    } as unknown as SerializedHeadingNode
    const state = makeState([heading])
    const { heading: converter } = createTableOfContentsConverter(state)
    const html = renderToStaticMarkup(<>{invoke(converter, heading)}</>)
    expect(html).toBe('<h2 id="my-section">My Section</h2>')
  })

  it("uses the supplied slugify function", () => {
    const heading = {
      type: "heading",
      tag: "h3",
      children: [{ type: "text", text: "Hi" }],
    } as unknown as SerializedHeadingNode
    const state = makeState([heading])
    const { heading: converter } = createTableOfContentsConverter(state, (t) => `x-${t}`)
    const html = renderToStaticMarkup(<>{invoke(converter, heading)}</>)
    expect(html).toContain('id="x-Hi"')
    expect(html).toContain("<h3")
  })

  it("disambiguates duplicate heading text with suffixed ids", () => {
    const h1 = {
      type: "heading",
      tag: "h2",
      children: [{ type: "text", text: "Same" }],
    } as unknown as SerializedHeadingNode
    const h2 = {
      type: "heading",
      tag: "h2",
      children: [{ type: "text", text: "Same" }],
    } as unknown as SerializedHeadingNode
    const state = makeState([h1, h2])
    const { heading: converter } = createTableOfContentsConverter(state)
    const html1 = renderToStaticMarkup(<>{invoke(converter, h1)}</>)
    const html2 = renderToStaticMarkup(<>{invoke(converter, h2)}</>)
    expect(html1).toContain('id="same"')
    expect(html2).toContain('id="same-2"')
  })

  it("omits id when node has no precomputed anchor", () => {
    const known = {
      type: "heading",
      tag: "h2",
      children: [{ type: "text", text: "Known" }],
    } as unknown as SerializedHeadingNode
    const orphan = {
      type: "heading",
      tag: "h2",
      children: [{ type: "text", text: "Orphan" }],
    } as unknown as SerializedHeadingNode
    const state = makeState([known])
    const { heading: converter } = createTableOfContentsConverter(state)
    const html = renderToStaticMarkup(<>{invoke(converter, orphan)}</>)
    expect(html).not.toContain("id=")
  })
})
