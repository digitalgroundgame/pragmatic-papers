import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createHeadingNode, createParagraph, createRichText } from "@/utilities/lexical"

vi.mock("server-only", () => ({}))

import { SitePageHeader } from "../SitePageHeader"

afterEach(cleanup)

describe("a site page's header", () => {
  it("shows the route's own title and line while there's no page", () => {
    render(<SitePageHeader title="Topics" description="Browse all topics" />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Topics")
    expect(screen.getByText("Browse all topics")).toBeInTheDocument()
  })

  it("shows the page's hero text, its h1 the page's only one", () => {
    const richText = createRichText([
      createHeadingNode("Every topic", "h1"),
      createParagraph("What we write about."),
    ])
    render(
      <SitePageHeader
        hero={{ type: "pageHero", richText }}
        title="Topics"
        description="Browse all topics"
      />,
    )
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Every topic")
    expect(screen.getByText("What we write about.")).toBeInTheDocument()
    expect(screen.queryByText("Browse all topics")).not.toBeInTheDocument()
  })

  it("keeps a hidden h1 when the hero text has none", () => {
    render(
      <SitePageHeader
        hero={{ type: "pageHero", richText: createRichText([createParagraph("Intro.")]) }}
        title="Topics"
      />,
    )
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("sr-only")
  })

  it("falls back to the title for a page with no hero", () => {
    render(<SitePageHeader hero={{ type: "none" }} title="Topics" description="Browse" />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Topics")
    expect(screen.queryByText("Browse")).not.toBeInTheDocument()
  })
})
