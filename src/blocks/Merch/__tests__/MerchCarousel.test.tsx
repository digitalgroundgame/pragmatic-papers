import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Embla only needs the plugin to look like one; the real timer behaviour is the
// plugin's own concern, so assert on whether we hand it to embla at all.
const autoplayPlugin = {
  name: "autoplay",
  options: {},
  init: vi.fn(),
  destroy: vi.fn(),
}
const Autoplay = vi.fn((_options: unknown) => autoplayPlugin)

vi.mock("embla-carousel-autoplay", () => ({ default: (options: unknown) => Autoplay(options) }))

import { MerchCarousel } from "../MerchCarousel"

/** jsdom has no `matchMedia`; vitest.setup stubs a never-matching one. */
function stubReducedMotion(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  Autoplay.mockClear()
  stubReducedMotion(false)
})

afterEach(cleanup)

describe("MerchCarousel", () => {
  it("renders its slides without autoplay by default", () => {
    render(
      <MerchCarousel>
        <div>Slides</div>
      </MerchCarousel>,
    )

    expect(screen.getByText("Slides")).toBeTruthy()
    expect(Autoplay).not.toHaveBeenCalled()
  })

  it("registers the autoplay plugin when the block opts in", () => {
    render(
      <MerchCarousel autoplay>
        <div>Slides</div>
      </MerchCarousel>,
    )

    expect(Autoplay).toHaveBeenCalledTimes(1)
    expect(Autoplay).toHaveBeenCalledWith(
      expect.objectContaining({
        stopOnInteraction: true,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
      }),
    )
  })

  it("skips autoplay for readers who prefer reduced motion", () => {
    stubReducedMotion(true)

    render(
      <MerchCarousel autoplay>
        <div>Slides</div>
      </MerchCarousel>,
    )

    expect(screen.getByText("Slides")).toBeTruthy()
    expect(Autoplay).not.toHaveBeenCalled()
  })
})
