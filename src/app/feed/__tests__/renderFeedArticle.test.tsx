import { render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"
import type { LexicalNode } from "../types"
import { block, landscapeImage, makeFeedArticle, paragraph } from "./fixtures"

vi.mock("server-only", () => ({}))
vi.mock("@/components/Media", async () => (await import("./mediaStub")).mediaStub)
// RichText is server-only and renders blocks that query Payload. Swap it for a
// marker that shows which nodes a page was handed.
vi.mock("@/components/RichText", () => ({
  default: ({ data }: { data: { root: { children: LexicalNode[] } } }) => (
    <div data-testid="rich-text">
      {data.root.children.map((node) => String(node.type)).join(",")}
    </div>
  ),
}))

const { renderFeedArticle } = await import("../renderFeedArticle")

function renderBody(body: React.ReactNode) {
  return render(<>{body}</>)
}

describe("renderFeedArticle", () => {
  it("sends the client the article without its body, with each page's timing", () => {
    const article = makeFeedArticle({ footnotes: [] }, [paragraph("one two three")])

    const { article: summary, pages, bodies } = renderFeedArticle(article)

    expect(summary).not.toHaveProperty("content")
    expect(summary).not.toHaveProperty("footnotes")
    expect(summary.title).toBe(article.title)
    expect(pages).toEqual([
      { kind: "hero", durationMs: 4500 },
      { kind: "content", durationMs: 3500 },
    ])
    expect(bodies[0]).toBeNull()
  })

  it("renders prose through RichText and marks the last page", () => {
    const { bodies } = renderFeedArticle(makeFeedArticle({}, [paragraph("a"), paragraph("b")]))

    const { container } = renderBody(bodies[1])
    expect(screen.getByTestId("rich-text")).toHaveTextContent("paragraph,paragraph")
    expect(container.querySelector("[class*='squiggle-static']")).toBeInTheDocument()
  })

  it("shows a block page's heading above the block", () => {
    const heading: LexicalNode = {
      type: "heading",
      tag: "h2",
      version: 1,
      children: [{ type: "text", version: 1, text: "The data" }],
    }
    const { bodies } = renderFeedArticle(
      makeFeedArticle({}, [heading, block("socialEmbed"), paragraph("after")]),
    )

    renderBody(bodies[1])
    expect(screen.getByRole("heading", { name: "The data" })).toBeInTheDocument()
    // No feed renderer for `socialEmbed`: it falls back to the RichText converters.
    expect(screen.getByTestId("rich-text")).toHaveTextContent("block")
  })

  it("renders media full screen", () => {
    const { bodies } = renderFeedArticle(
      makeFeedArticle({}, [block("mediaBlock", { media: landscapeImage })]),
    )
    renderBody(bodies[1])
    expect(screen.getByAltText("Mountains at sunset")).toBeInTheDocument()
  })

  it("renders nothing for media that didn't resolve", () => {
    const { bodies } = renderFeedArticle(makeFeedArticle({}, [block("mediaBlock", { media: 4 })]))
    renderBody(bodies[1])
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })
})
