import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Dot } from "../dot"

afterEach(cleanup)

describe("Dot", () => {
  it("renders a small, round, brand-coloured decorative span by default", () => {
    const { container } = render(<Dot />)

    const dot = container.firstElementChild
    expect(dot?.tagName).toBe("SPAN")
    expect(dot).toHaveAttribute("aria-hidden", "true")
    expect(dot).toHaveAttribute("data-slot", "dot")
    expect(dot).toHaveClass("inline-block", "shrink-0", "size-2", "rounded-full", "bg-brand")
    expect(dot).not.toHaveClass("ring-2")
  })

  it("takes a size, shape, tone and ring", () => {
    const { container } = render(<Dot size="md" shape="square" tone="muted" ring />)

    expect(container.firstElementChild).toHaveClass(
      "size-2.5",
      "rounded-sm",
      "bg-muted-foreground",
      "ring-2",
      "ring-background",
    )
  })

  it("leaves the fill to `style` with tone none", () => {
    const { container } = render(<Dot tone="none" style={{ background: "rgb(1, 2, 3)" }} />)

    expect(container.firstElementChild).not.toHaveClass("bg-brand")
    expect(container.firstElementChild).toHaveStyle({ background: "rgb(1, 2, 3)" })
  })

  it("lets a caller's classes win over the variant's", () => {
    const { container } = render(<Dot tone="muted" className="bg-primary" />)

    expect(container.firstElementChild).toHaveClass("bg-primary")
    expect(container.firstElementChild).not.toHaveClass("bg-muted-foreground")
  })

  it("keeps a data-slot the caller sets", () => {
    const { container } = render(<Dot data-slot="fresh" />)

    expect(container.firstElementChild).toHaveAttribute("data-slot", "fresh")
  })

  it("renders as an interactive element, which is not hidden from assistive tech", () => {
    const onClick = vi.fn()
    render(<Dot render={<button type="button" aria-label="Go to slide 1" onClick={onClick} />} />)

    const button = screen.getByRole("button", { name: "Go to slide 1" })
    expect(button).not.toHaveAttribute("aria-hidden")
    expect(button).toHaveClass("size-2", "rounded-full")
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
