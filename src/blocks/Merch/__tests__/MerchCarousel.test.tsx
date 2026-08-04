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

// jsdom has no layout, so a real embla instance always reports "nothing to
// scroll". Stub the hook to drive the states the controls actually branch on.
// `CarouselPrevious`/`CarouselIndicators` call the module-internal hook, so
// those still need a real <Carousel> ancestor.
const carousel = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))

vi.mock("@/components/ui/carousel", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, useCarousel: () => carousel.state }
})

import { Carousel } from "@/components/ui/carousel"
import { MerchCarousel, MerchCarouselControls, MerchCarouselDots } from "../MerchCarousel"

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
  carousel.state = { canScrollPrev: false, canScrollNext: false, api: undefined }
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

describe("MerchCarouselControls", () => {
  it("hides the arrows when every product already fits", () => {
    render(
      <Carousel>
        <MerchCarouselControls />
      </Carousel>,
    )

    expect(screen.queryByRole("button", { name: "Previous slide" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Next slide" })).toBeNull()
  })

  it("shows the arrows once there is something to scroll to", () => {
    carousel.state = { canScrollPrev: false, canScrollNext: true }

    render(
      <Carousel>
        <MerchCarouselControls />
      </Carousel>,
    )

    expect(screen.getByRole("button", { name: "Previous slide" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Next slide" })).toBeTruthy()
  })
})

describe("MerchCarouselDots", () => {
  const fakeApi = (snapCount: number) => ({
    scrollSnapList: () => Array.from({ length: snapCount }, (_, i) => i),
    selectedScrollSnap: () => 0,
    on: () => undefined,
    off: () => undefined,
  })

  it("renders one dot per snap point", () => {
    carousel.state = { api: fakeApi(3) }

    render(
      <Carousel>
        <MerchCarouselDots />
      </Carousel>,
    )

    expect(screen.getAllByRole("button", { name: /Go to slide/ })).toHaveLength(3)
  })

  it("renders nothing when everything fits in one snap", () => {
    carousel.state = { api: fakeApi(1) }

    render(
      <Carousel>
        <MerchCarouselDots />
      </Carousel>,
    )

    expect(screen.queryByRole("button", { name: /Go to slide/ })).toBeNull()
  })
})
