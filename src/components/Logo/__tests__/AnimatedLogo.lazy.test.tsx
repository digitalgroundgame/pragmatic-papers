import { render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// vitest.setup.ts swaps the lazy wrapper for the real component everywhere else.
vi.unmock("@/components/Logo/AnimatedLogo.lazy")

vi.mock("../AnimatedLogo", () => ({
  // The player and its animations are AnimatedLogo's own business (AnimatedLogo.test.tsx).
  AnimatedLogo: ({ className }: { className?: string }) => (
    <div data-testid="animated-logo" className={className} />
  ),
}))
vi.mock("@/components/Logo", () => ({
  Logo: ({ className }: { className?: string }) => (
    <svg data-testid="still-logo" className={className} />
  ),
}))

import { LazyAnimatedLogo } from "../AnimatedLogo.lazy"

describe("LazyAnimatedLogo", () => {
  it("renders the still logo on the server, where the animation never loads", () => {
    const html = renderToString(<LazyAnimatedLogo className="h-8" />)
    expect(html).toContain('data-testid="still-logo"')
    expect(html).toContain('class="h-8"')
    expect(html).not.toContain("animated-logo")
  })

  it("shows the still logo until the animated one has loaded, then swaps it in", async () => {
    render(<LazyAnimatedLogo className="h-8" />)
    expect(screen.getByTestId("still-logo")).toHaveClass("h-8")

    expect(await screen.findByTestId("animated-logo")).toHaveClass("h-8")
    expect(screen.queryByTestId("still-logo")).not.toBeInTheDocument()
  })
})
