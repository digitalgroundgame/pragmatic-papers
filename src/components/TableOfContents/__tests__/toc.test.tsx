import { cleanup, render, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { DefaultTypedEditorState } from "@payloadcms/richtext-lexical"
import { stampTableOfContentsAnchors, TableOfContents, TableOfContentsProvider } from ".."

function makeState(children: unknown[]): DefaultTypedEditorState {
  return stampTableOfContentsAnchors({
    root: { type: "root", children, direction: null, format: "", indent: 0, version: 1 },
  } as DefaultTypedEditorState)
}

afterEach(cleanup)

function block(blockType: string, fields: Record<string, unknown> = {}) {
  return { type: "block", fields: { blockType, ...fields } } as object
}

function renderToc(children: unknown[]) {
  return render(
    <TableOfContentsProvider>
      <TableOfContents content={makeState(children)} />
    </TableOfContentsProvider>,
  )
}

describe("app TOC instance — socialEmbed resolver", () => {
  it.each([
    ["bluesky", "Bluesky embed"],
    ["reddit", "Reddit embed"],
    ["tiktok", "TikTok embed"],
    ["twitter", "Twitter embed"],
    ["youtube", "YouTube embed"],
  ])("labels %s as %s", (platform, expected) => {
    const { getByText } = renderToc([block("socialEmbed", { id: "e1", platform })])
    expect(getByText(expected)).toBeInTheDocument()
  })

  it("uses 'Social embed' fallback when platform is missing", () => {
    const { getByText } = renderToc([block("socialEmbed", { id: "e1" })])
    expect(getByText("Social embed")).toBeInTheDocument()
  })

  it("anchors embeds from their label, deduplicated", () => {
    const { getAllByRole } = renderToc([
      block("socialEmbed", { id: "e1", platform: "youtube" }),
      block("socialEmbed", { id: "e2", platform: "youtube" }),
    ])
    const hrefs = getAllByRole("link").map((link) => link.getAttribute("href"))
    expect(hrefs).toContain("#youtube-embed")
    expect(hrefs).toContain("#youtube-embed-2")
  })

  it("renders the TvIcon next to the label", () => {
    const { getByText } = renderToc([block("socialEmbed", { platform: "twitter" })])
    expect(getByText("Twitter embed").closest("a")?.querySelector("svg")).toBeInTheDocument()
  })
})

describe("app TOC instance — exhibit blocks", () => {
  it("labels an interactive map by its widget title", () => {
    const { getByRole } = renderToc([
      block("interactiveMap", { widgetTitle: "2024 margins", maps: [{ title: "House" }] }),
    ])
    const link = getByRole("link", { name: /2024 margins/ })
    expect(link).toHaveAttribute("href", "#2024-margins")
    expect(link.querySelector("svg")).toBeInTheDocument()
  })

  it("labels a single untitled-widget map by the map's title", () => {
    const { getByText } = renderToc([block("interactiveMap", { maps: [{ title: "Senate" }] })])
    expect(getByText("Senate")).toBeInTheDocument()
  })

  it("falls back to 'Map' when several maps share an untitled widget", () => {
    const { getByText } = renderToc([
      block("interactiveMap", { maps: [{ title: "House" }, { title: "Senate" }] }),
    ])
    expect(getByText("Map")).toBeInTheDocument()
  })

  it("labels a timeline by its title, falling back to 'Timeline'", () => {
    const { getAllByRole } = renderToc([
      block("timeline", { title: "How we got here" }),
      block("timeline"),
    ])
    const labels = getAllByRole("link").map((link) => link.textContent)
    expect(labels).toEqual(expect.arrayContaining(["How we got here", "Timeline"]))
  })

  it("lists a gallery only when it has images", () => {
    const { getByRole } = renderToc([
      block("mediaCollage", { images: [{ media: 1 }] }),
      block("mediaCollage", { images: [] }),
    ])
    const nav = getByRole("navigation")
    expect(within(nav).getAllByText("Image grid")).toHaveLength(1)
  })

  it("names a gallery by its layout", () => {
    const { getAllByRole } = renderToc([
      block("mediaCollage", { layout: "grid", images: [{ media: 1 }] }),
      block("mediaCollage", { layout: "carousel", images: [{ media: 1 }] }),
    ])
    const labels = getAllByRole("link").map((link) => link.textContent)
    expect(labels).toEqual(expect.arrayContaining(["Image grid", "Carousel"]))
  })

  it("shares one anchor namespace with headings", () => {
    const heading = {
      type: "heading",
      tag: "h2",
      children: [{ type: "text", text: "Timeline" }],
    }
    const { getAllByRole } = renderToc([heading, block("timeline")])
    const hrefs = getAllByRole("link").map((link) => link.getAttribute("href"))
    expect(hrefs).toEqual(expect.arrayContaining(["#timeline", "#timeline-2"]))
  })
})
