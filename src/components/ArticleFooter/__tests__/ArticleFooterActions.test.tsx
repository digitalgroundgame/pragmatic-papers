import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ArticleFooterActions } from "../ArticleFooterActions"

const substackUrl = "https://thepragmaticpapers.substack.com/p/an-article"
const article = { slug: "an-article", title: "An article" }

describe("ArticleFooterActions", () => {
  afterEach(cleanup)

  it("puts the share button to the right of Read on Substack", () => {
    render(
      <ArticleFooterActions article={{ ...article, syndicateToSubstack: true, substackUrl }} />,
    )

    const substack = screen.getByRole("link", { name: "Read on Substack" })
    const share = screen.getByRole("button", { name: "Share" })
    expect(substack).toHaveAttribute("href", substackUrl)
    expect(substack).toHaveTextContent("Read on Substack")
    expect(substack.compareDocumentPosition(share)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("keeps the share button on an article that isn't on Substack", () => {
    render(<ArticleFooterActions article={{ ...article, syndicateToSubstack: false }} />)

    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Read on Substack" })).not.toBeInTheDocument()
  })
})
