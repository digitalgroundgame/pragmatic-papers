import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

let pathname = "/"
vi.mock("next/navigation", () => ({ usePathname: () => pathname }))

vi.mock("@/components/Logo/AnimatedLogo", () => ({
  // The real one pulls in the player and a 76KB animation, neither of which this is about.
  AnimatedLogo: () => <div data-testid="animated-logo" />,
}))

import { drawsLogo, HeaderLogo } from "../chrome"

describe("drawsLogo", () => {
  it("draws the wordmark on the interactives and nowhere else", () => {
    expect(drawsLogo("/interactives")).toBe(true)
    expect(drawsLogo("/interactives/federal-courts")).toBe(true)
    expect(drawsLogo("/")).toBe(false)
    expect(drawsLogo("/articles/something")).toBe(false)
    expect(drawsLogo(null)).toBe(false)
  })
})

describe("HeaderLogo", () => {
  it("draws the wordmark on an interactive and sets it everywhere else", () => {
    pathname = "/interactives"
    const { container, queryByTestId, rerender } = render(<HeaderLogo />)
    expect(queryByTestId("animated-logo")).toBeInTheDocument()

    // Elsewhere the animation is not merely hidden — it is never reached, so neither is the
    // player it would have brought with it.
    pathname = "/articles/x"
    rerender(<HeaderLogo />)
    expect(queryByTestId("animated-logo")).not.toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })
})
