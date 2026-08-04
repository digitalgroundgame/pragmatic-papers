import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Media, MerchBlock as MerchBlockProps } from "@/payload-types"

// `@/components/Media` renders next/image, which needs the Next runtime. Swap
// it for a plain <img>; `isMedia` keeps its real (trivial) semantics.
vi.mock("@/components/Media", () => ({
  isMedia: (media: unknown): boolean => Boolean(media) && typeof media !== "number",
  // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
  Media: ({ media }: { media: Media }) => <img alt={media?.alt ?? "product"} />,
}))

import { MerchBlock } from "../Component"

const image = { id: 1, alt: "A mug", mimeType: "image/png", url: "/mug.png" } as unknown as Media

function makeProps(overrides: Partial<MerchBlockProps> = {}): MerchBlockProps {
  return {
    blockType: "merch",
    heading: "Merch",
    layout: "fullWidth",
    storeUrl: "https://store.example.com/",
    products: [
      { id: "1", image, title: "DiGG Mug", price: "$15.00", url: "https://store.example.com/mug" },
      { id: "2", image, title: "DiGG Tee", url: "https://store.example.com/tee" },
    ],
    ...overrides,
  }
}

afterEach(cleanup)

describe("MerchBlock", () => {
  it("renders nothing when there are no products", () => {
    const { container } = render(<MerchBlock {...makeProps({ products: [] })} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the heading and each product's title", () => {
    render(<MerchBlock {...makeProps()} />)

    expect(screen.getByRole("heading", { name: "Merch" })).toBeTruthy()
    expect(screen.getByText("DiGG Mug")).toBeTruthy()
    expect(screen.getByText("DiGG Tee")).toBeTruthy()
  })

  it("shows a price only when one is provided", () => {
    render(<MerchBlock {...makeProps()} />)

    expect(screen.getByText("$15.00")).toBeTruthy()
    // The tee has no price, so no other price text renders.
    expect(screen.queryAllByText(/^\$/)).toHaveLength(1)
  })

  it("links each product card to its product URL in a new tab", () => {
    render(<MerchBlock {...makeProps()} />)

    const mug = screen.getByText("DiGG Mug").closest("a")
    expect(mug?.getAttribute("href")).toBe("https://store.example.com/mug")
    expect(mug?.getAttribute("target")).toBe("_blank")
    expect(mug?.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("links 'Shop all' to the store URL", () => {
    render(<MerchBlock {...makeProps()} />)

    const storeLink = screen.getByText("Shop all").closest("a")
    expect(storeLink?.getAttribute("href")).toBe("https://store.example.com/")
    expect(storeLink?.getAttribute("target")).toBe("_blank")
  })

  it("falls back to the default heading and store URL when omitted", () => {
    render(<MerchBlock {...makeProps({ heading: null, storeUrl: null })} />)

    expect(screen.getByRole("heading", { name: "The Pragmatic Papers Store" })).toBeTruthy()
    const storeLink = screen.getByText("Shop all").closest("a")
    expect(storeLink?.getAttribute("href")).toBe("https://pragmaticpapers.org/store")
  })

  it("shows one product at a time for the square (sidebar) layout", () => {
    const { container } = render(<MerchBlock {...makeProps({ layout: "square" })} />)

    const slides = container.querySelectorAll('[aria-roledescription="slide"]')
    expect(slides).toHaveLength(2)
    // No responsive basis overrides — `CarouselItem`'s `basis-full` stands.
    expect(slides[0]?.className).not.toMatch(/basis-1\//)
  })

  it("fans slides out with the viewport for the full-width layout", () => {
    const { container } = render(<MerchBlock {...makeProps({ layout: "fullWidth" })} />)

    const slides = container.querySelectorAll('[aria-roledescription="slide"]')
    expect(slides).toHaveLength(2)
    expect(slides[0]?.className).toContain("sm:basis-1/2")
    expect(slides[0]?.className).toContain("lg:basis-1/4")
  })

  it("renders carousel controls for both layouts", () => {
    for (const layout of ["square", "fullWidth"] as const) {
      render(<MerchBlock {...makeProps({ layout })} />)

      expect(screen.getByRole("button", { name: "Previous slide" })).toBeTruthy()
      expect(screen.getByRole("button", { name: "Next slide" })).toBeTruthy()
      cleanup()
    }
  })
})
