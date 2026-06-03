import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import { TableOfContents } from "../Component"

function makeContent(children: unknown[]): DefaultTypedEditorState {
  return {
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as DefaultTypedEditorState
}

function heading(tag: string, text: string) {
  return {
    type: "heading",
    tag,
    children: [{ type: "text", text }],
    direction: null,
    format: "",
    indent: 0,
    version: 1,
  } as object
}

describe("TableOfContents component", () => {
  it("renders nothing when there are no entries", () => {
    const { container } = render(<TableOfContents content={makeContent([])} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nav, default title, and one link per heading", () => {
    const { container, getByRole, getByText } = render(
      <TableOfContents content={makeContent([heading("h2", "Intro"), heading("h3", "Details")])} />,
    )
    expect(getByRole("navigation", { name: /table of contents/i })).toBeTruthy()
    expect(getByText("Table of Contents")).toBeTruthy()
    const links = container.querySelectorAll("a")
    expect(links).toHaveLength(2)
    expect(links[0]!.getAttribute("href")).toBe("#intro")
    expect(links[1]!.getAttribute("href")).toBe("#details")
  })

  it("omits the title when title prop is empty", () => {
    const { container } = render(
      <TableOfContents content={makeContent([heading("h2", "Only")])} title="" />,
    )
    expect(container.querySelector("h3")).toBeNull()
  })

  it("renders a custom title", () => {
    const { getByText } = render(
      <TableOfContents content={makeContent([heading("h2", "Only")])} title="On this page" />,
    )
    expect(getByText("On this page")).toBeTruthy()
  })

  it("nests deeper headings inside shallower ones", () => {
    const { container } = render(
      <TableOfContents content={makeContent([heading("h2", "A"), heading("h4", "Deep")])} />,
    )
    const rootUl = container.querySelector("ul")
    const nestedUl = container.querySelector("li > ul")
    expect(nestedUl).toBeTruthy()
    expect(nestedUl).not.toBe(rootUl)
  })

  it("renders an icon when the resolver supplies one", () => {
    const FakeIcon = (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="fake-icon" {...props} />
    )
    const block = { type: "block", fields: { blockType: "widget", id: "w1" } } as object
    const { getByTestId } = render(
      <TableOfContents
        content={makeContent([block])}
        resolvers={{
          widget: () => ({ label: "Widget", anchor: "w1", icon: FakeIcon }),
        }}
      />,
    )
    expect(getByTestId("fake-icon")).toBeTruthy()
  })

  it("falls back to '#' when entry anchor is empty", () => {
    const block = { type: "block", fields: { blockType: "weird" } } as object
    const { container } = render(
      <TableOfContents
        content={makeContent([block])}
        resolvers={{ weird: () => ({ label: "No anchor", anchor: "" }) }}
      />,
    )
    const link = container.querySelector("a")
    expect(link?.getAttribute("href")).toBe("#")
  })

  it("uses the supplied slugify function", () => {
    const upper = (text: string) => text.toUpperCase().replace(/\s+/g, "_")
    const { container } = render(
      <TableOfContents content={makeContent([heading("h2", "Hello World")])} slugify={upper} />,
    )
    expect(container.querySelector("a")?.getAttribute("href")).toBe("#HELLO_WORLD")
  })
})
