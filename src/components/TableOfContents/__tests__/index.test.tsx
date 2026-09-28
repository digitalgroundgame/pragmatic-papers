import { render } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { DefaultTypedEditorState, SerializedHeadingNode } from "@payloadcms/richtext-lexical"
import { createTableOfContents } from "../create"
import { stampAnchors } from "../traverse"
import { tableOfContentsField } from "../field"

type HeadingConverterFn = (args: {
  node: SerializedHeadingNode
  nodesToJSX: unknown
}) => React.ReactNode

function makeState(children: unknown[]): DefaultTypedEditorState {
  return stampAnchors({
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as DefaultTypedEditorState)
}

function heading(tag: string, text: string) {
  return {
    type: "heading",
    tag,
    children: [{ type: "text", text }],
  } as unknown as SerializedHeadingNode
}

describe("createTableOfContents", () => {
  it("returns the field, components, converters, entries builder, and anchor hook", () => {
    const toc = createTableOfContents()
    expect(toc.tableOfContentsField).toBe(tableOfContentsField)
    expect(typeof toc.TableOfContentsProvider).toBe("function")
    expect(typeof toc.TableOfContents).toBe("function")
    expect(typeof toc.tableOfContentsConverter.heading).toBe("function")
    expect(typeof toc.tableOfContentsEntries).toBe("function")
    expect(typeof toc.populateTableOfContentsAnchors).toBe("function")
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
      <toc.TableOfContentsProvider>
        <toc.TableOfContents content={state} />
      </toc.TableOfContentsProvider>,
    )
    expect(getByText("First")).toBeTruthy()
    expect(getByText("Custom Entry")).toBeTruthy()
    const links = container.querySelectorAll("a")
    expect(links[1]!.getAttribute("href")).toBe("#c1")
  })

  it("populateTableOfContentsAnchors stamps anchors with the supplied slugify", async () => {
    const toc = createTableOfContents({ slugify: (text) => text.toLowerCase().replace(/ /g, "_") })
    const raw = {
      root: {
        type: "root",
        children: [heading("h2", "Hello World")],
        direction: null,
        format: "",
        indent: 0,
        version: 1,
      },
    } as DefaultTypedEditorState
    const stamped = await toc.populateTableOfContentsAnchors({
      value: raw,
    } as Parameters<typeof toc.populateTableOfContentsAnchors>[0])

    expect(toc.tableOfContentsEntries(stamped!)[0]).toMatchObject({ anchor: "hello_world" })
    const converter = toc.tableOfContentsConverter.heading as unknown as HeadingConverterFn
    const html = renderToStaticMarkup(
      <>
        {converter({
          node: stamped!.root.children[0] as SerializedHeadingNode,
          nodesToJSX: ({ nodes }: { nodes: unknown }) =>
            ((nodes as { text?: string }[] | undefined) ?? []).map((n) => n.text ?? ""),
        })}
      </>,
    )
    expect(html).toContain('id="hello_world"')
  })

  it("stampTableOfContentsAnchors stamps with the supplied slugify", () => {
    const toc = createTableOfContents({ slugify: (text) => text.toLowerCase().replace(/ /g, "_") })
    const stamped = toc.stampTableOfContentsAnchors({
      root: {
        type: "root",
        children: [heading("h2", "Hello World")],
        direction: null,
        format: "",
        indent: 0,
        version: 1,
      },
    } as DefaultTypedEditorState)

    expect(toc.tableOfContentsEntries(stamped)[0]).toMatchObject({ anchor: "hello_world" })
  })

  it("stampTableOfContentsAnchors keeps the intro anchor free for the Intro entry", () => {
    const toc = createTableOfContents()
    const stamped = toc.stampTableOfContentsAnchors({
      root: {
        type: "root",
        children: [{ type: "paragraph", children: [], version: 1 }, heading("h2", "Intro")],
        direction: null,
        format: "",
        indent: 0,
        version: 1,
      },
    } as DefaultTypedEditorState)

    expect(toc.tableOfContentsEntries(stamped).map((entry) => entry.anchor)).toEqual([
      "intro",
      "intro-2",
    ])
  })

  it("populateTableOfContentsAnchors passes an empty value through", async () => {
    const toc = createTableOfContents()
    const args = { value: null } as Parameters<typeof toc.populateTableOfContentsAnchors>[0]
    expect(await toc.populateTableOfContentsAnchors(args)).toBeNull()
  })

  it("TableOfContentsButton renders nothing when the content has no entries", () => {
    const toc = createTableOfContents()
    const { container } = render(
      <toc.TableOfContentsProvider>
        <toc.TableOfContentsButton content={makeState([])} />
      </toc.TableOfContentsProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("TableOfContentsButton renders when the content has entries", () => {
    const toc = createTableOfContents()
    const { getByRole } = render(
      <toc.TableOfContentsProvider>
        <toc.TableOfContentsButton content={makeState([heading("h2", "X")])} />
      </toc.TableOfContentsProvider>,
    )
    expect(getByRole("button", { name: /collapse table of contents/i })).toBeInTheDocument()
  })

  it("forwards className and title props to Body", () => {
    const toc = createTableOfContents()
    const { container, getByText } = render(
      <toc.TableOfContentsProvider>
        <toc.TableOfContents
          content={makeState([heading("h2", "X")])}
          className="custom-toc"
          title="Outline"
        />
      </toc.TableOfContentsProvider>,
    )
    expect(container.querySelector("nav.custom-toc")).toBeTruthy()
    expect(getByText("Outline")).toBeTruthy()
  })
})
