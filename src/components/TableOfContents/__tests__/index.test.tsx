import { render } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { DefaultTypedEditorState, SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import { createTableOfContents } from "../create"
import { tableOfContentsField } from "../field"

type HeadingConverterFn = (args: {
  node: SerializedHeadingNode
  nodesToJSX: unknown
}) => React.ReactNode

function makeState(children: unknown[]): DefaultTypedEditorState {
  return {
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as DefaultTypedEditorState
}

function heading(tag: string, text: string) {
  return {
    type: "heading",
    tag,
    children: [{ type: "text", text }],
  } as unknown as SerializedHeadingNode
}

describe("createTableOfContents", () => {
  it("returns the field, Root, Body, and headingConverter", () => {
    const toc = createTableOfContents()
    expect(toc.tableOfContentsField).toBe(tableOfContentsField)
    expect(typeof toc.TableOfContentsProvider).toBe("function")
    expect(typeof toc.TableOfContents).toBe("function")
    expect(typeof toc.tableOfContentsConverter).toBe("function")
  })

  it("Root renders entries from caller resolvers", () => {
    const toc = createTableOfContents({
      resolvers: {
        custom: (block) => {
          const f = block as { id: string; name: string }
          return { label: f.name, anchor: f.id }
        },
      },
    })
    const state = makeState([
      heading("h2", "First"),
      { type: "block", fields: { blockType: "custom", id: "c1", name: "Custom Entry" } },
    ])
    const { getByText, container } = render(
      <toc.TableOfContentsProvider content={state}>
        <toc.TableOfContents />
      </toc.TableOfContentsProvider>,
    )
    expect(getByText("First")).toBeTruthy()
    expect(getByText("Custom Entry")).toBeTruthy()
    const links = container.querySelectorAll("a")
    expect(links[1]!.getAttribute("href")).toBe("#c1")
  })

  it("headingConverter uses the supplied slugify across both anchors and ids", () => {
    const toc = createTableOfContents({ slugify: (text) => text.toLowerCase().replace(/ /g, "_") })
    const h = heading("h2", "Hello World")
    const state = makeState([h])

    const { container } = render(
      <toc.TableOfContentsProvider content={state}>
        <toc.TableOfContents />
      </toc.TableOfContentsProvider>,
    )
    expect(container.querySelector("a")?.getAttribute("href")).toBe("#hello_world")

    const converter = toc.tableOfContentsConverter(state).heading as unknown as HeadingConverterFn
    const html = renderToStaticMarkup(
      <>
        {converter({
          node: h,
          nodesToJSX: ({ nodes }: { nodes: unknown }) =>
            ((nodes as { text?: string }[] | undefined) ?? []).map((n) => n.text ?? ""),
        })}
      </>,
    )
    expect(html).toContain('id="hello_world"')
  })

  it("forwards className and title props to Body", () => {
    const toc = createTableOfContents()
    const { container, getByText } = render(
      <toc.TableOfContentsProvider content={makeState([heading("h2", "X")])}>
        <toc.TableOfContents className="custom-toc" title="Outline" />
      </toc.TableOfContentsProvider>,
    )
    expect(container.querySelector("nav.custom-toc")).toBeTruthy()
    expect(getByText("Outline")).toBeTruthy()
  })
})
