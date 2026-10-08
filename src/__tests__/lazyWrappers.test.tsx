import { render, screen } from "@testing-library/react"
import type React from "react"
import { describe, expect, it, vi } from "vitest"

// vitest.setup.ts hands every other test the real components behind these wrappers. Here
// the wrappers themselves are under test: each must load its module lazily and render the
// export it names, passing props through.
vi.unmock("@/blocks/Code/Component.lazy")
vi.unmock("@/blocks/Form/FormBlockClient.lazy")
vi.unmock("@/blocks/InteractiveMap/InteractiveMapClient.lazy")
vi.unmock("@/blocks/MediaCollageBlock/component.lazy")
vi.unmock("@/blocks/Merch/MerchCarousel.lazy")
vi.unmock("@/components/Media/lazy")

/** A stand-in for a lazily loaded component that shows which one rendered, with what. */
function stub(name: string): React.FC<{ children?: React.ReactNode } & Record<string, unknown>> {
  const Stub: React.FC<{ children?: React.ReactNode } & Record<string, unknown>> = ({
    children,
    ...props
  }) => (
    <div data-testid={name} data-props={JSON.stringify(props)}>
      {children}
    </div>
  )
  Stub.displayName = name
  return Stub
}

vi.mock("@/blocks/Code/Component.client", () => ({ Code: stub("Code") }))
vi.mock("@/blocks/Form/FormBlockClient", () => ({ FormBlockClient: stub("FormBlockClient") }))
vi.mock("@/blocks/InteractiveMap/InteractiveMapClient", () => ({
  InteractiveMapClient: stub("InteractiveMapClient"),
}))
vi.mock("@/blocks/MediaCollageBlock/component", () => ({
  MediaCollageBlock: stub("MediaCollageBlock"),
}))
vi.mock("@/blocks/Merch/MerchCarousel", () => ({
  MerchCarousel: stub("MerchCarousel"),
  MerchCarouselControls: stub("MerchCarouselControls"),
  MerchCarouselDots: stub("MerchCarouselDots"),
  CarouselContent: stub("CarouselContent"),
  CarouselItem: stub("CarouselItem"),
}))
vi.mock("@/components/Media/AudioMedia", () => ({ AudioMedia: stub("AudioMedia") }))
vi.mock("@/components/Media/VideoMedia", () => ({ VideoMedia: stub("VideoMedia") }))

import { Code } from "@/blocks/Code/Component.lazy"
import { FormBlockClient } from "@/blocks/Form/FormBlockClient.lazy"
import { InteractiveMapClient } from "@/blocks/InteractiveMap/InteractiveMapClient.lazy"
import { MediaCollageBlock } from "@/blocks/MediaCollageBlock/component.lazy"
import {
  CarouselContent,
  CarouselItem,
  MerchCarousel,
  MerchCarouselControls,
  MerchCarouselDots,
} from "@/blocks/Merch/MerchCarousel.lazy"
import { AudioMedia, VideoMedia } from "@/components/Media/lazy"

const props = async (name: string) =>
  JSON.parse((await screen.findByTestId(name)).getAttribute("data-props")!) as unknown

describe("lazy wrappers", () => {
  it.each([
    ["Code", Code, { code: "const a = 1", language: "ts" }],
    ["FormBlockClient", FormBlockClient, { enableIntro: false }],
    ["InteractiveMapClient", InteractiveMapClient, { layout: "single", maps: [] }],
    ["MediaCollageBlock", MediaCollageBlock, { id: "collage" }],
    ["MerchCarouselControls", MerchCarouselControls, {}],
    ["MerchCarouselDots", MerchCarouselDots, {}],
    ["CarouselContent", CarouselContent, { className: "track" }],
    ["CarouselItem", CarouselItem, { className: "slide" }],
    ["AudioMedia", AudioMedia, { className: "audio" }],
    ["VideoMedia", VideoMedia, { className: "video" }],
  ] as const)("%s renders the component it wraps, with its props", async (name, Lazy, given) => {
    const Component = Lazy as unknown as React.FC<Record<string, unknown>>
    render(<Component {...given} />)
    expect(await props(name)).toEqual(given)
  })

  it("passes children through, as the merch block nests its controls in the carousel", async () => {
    render(
      <MerchCarousel autoplay={false}>
        <MerchCarouselDots />
      </MerchCarousel>,
    )
    const carousel = await screen.findByTestId("MerchCarousel")
    expect(await screen.findByTestId("MerchCarouselDots")).toBeInTheDocument()
    expect(carousel).toContainElement(screen.getByTestId("MerchCarouselDots"))
  })
})
