import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Breadcrumbs } from "../index"

const trail = [
  { name: "Authors", path: "/contributors" },
  { name: "Jane Doe", path: "/contributors/jane-doe" },
]

describe("Breadcrumbs", () => {
  it("renders nothing for an empty trail", () => {
    const { container } = render(<Breadcrumbs items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("links each step but the last, which is the current page", () => {
    render(<Breadcrumbs items={trail} />)
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Authors" })).toHaveAttribute("href", "/contributors")
    const current = screen.getByText("Jane Doe")
    expect(current).toHaveAttribute("aria-current", "page")
    expect(current).not.toHaveAttribute("href")
  })

  it("stops at the reading column unless the page fills the container", () => {
    const { rerender } = render(<Breadcrumbs items={trail} />)
    const nav = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(nav).toHaveClass("container", "max-w-3xl", "mb-4")

    rerender(<Breadcrumbs fullWidth items={trail} />)
    expect(nav).toHaveClass("container")
    expect(nav).not.toHaveClass("max-w-3xl")
  })
})
