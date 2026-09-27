import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MathBlock } from "@/blocks/Math/Component"

// MathJax typesets against a real DOM/CDN payload, which jsdom has no use for —
// stub it out so these tests assert the accessibility wrapper, not typesetting.
vi.mock("better-react-mathjax/esm", () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

afterEach(() => {
  cleanup()
})

describe("MathBlock", () => {
  it("renders nothing when the expression is empty", () => {
    const { container } = render(<MathBlock blockType="displayMathBlock" math="" />)

    expect(container.innerHTML).toBe("")
  })

  it("exposes the description as the accessible name of a display formula", () => {
    const { getByRole } = render(
      <MathBlock
        blockType="displayMathBlock"
        math="a^2 + b^2 = c^2"
        description="the Pythagorean theorem"
      />,
    )

    const math = getByRole("math")
    expect(math).toHaveAttribute("aria-label", "the Pythagorean theorem")
    // The rendered LaTeX is hidden so a screen reader announces the description
    // instead of reading the markup character by character.
    expect(math.firstElementChild).toHaveAttribute("aria-hidden", "true")
    expect(math.textContent).toContain("a^2 + b^2 = c^2")
  })

  it("wraps an inline formula in a span so it stays inside the sentence", () => {
    const { getByRole } = render(
      <MathBlock blockType="inlineMathBlock" math="E=mc^2" description="mass-energy equivalence" />,
    )

    const math = getByRole("math")
    expect(math.tagName).toBe("SPAN")
    expect(math).toHaveAttribute("aria-label", "mass-energy equivalence")
  })

  it("omits the labelled wrapper when no description is provided", () => {
    const { queryByRole, container } = render(
      <MathBlock blockType="displayMathBlock" math="x = 1" />,
    )

    expect(queryByRole("math")).not.toBeInTheDocument()
    expect(container.querySelector("[aria-hidden]")).not.toBeInTheDocument()
    expect(container.textContent).toContain("x = 1")
  })
})
