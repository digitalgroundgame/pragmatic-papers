import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ReadOnSubstack } from ".."

const substackUrl = "https://thepragmaticpapers.substack.com/p/an-article"

describe("ReadOnSubstack", () => {
  afterEach(cleanup)

  it("links to the article's Substack post in a new tab", () => {
    render(<ReadOnSubstack article={{ syndicateToSubstack: true, substackUrl }} />)

    const link = screen.getByRole("link", { name: "Read on Substack" })
    expect(link).toHaveAttribute("href", substackUrl)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
  })

  it.each([
    ["has no Substack post URL", { syndicateToSubstack: true, substackUrl: null }],
    ["is no longer syndicated", { syndicateToSubstack: false, substackUrl }],
    [
      "holds an address that isn't on Substack",
      { syndicateToSubstack: true, substackUrl: "javascript:alert(1)" },
    ],
  ])("renders nothing when the article %s", (_label, article) => {
    const { container } = render(<ReadOnSubstack article={article} />)
    expect(container).toBeEmptyDOMElement()
  })
})
