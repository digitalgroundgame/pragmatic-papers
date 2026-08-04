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
    const href = new URL(mug?.getAttribute("href") ?? "")
    expect(href.origin + href.pathname).toBe("https://store.example.com/mug")
    expect(mug?.getAttribute("target")).toBe("_blank")
    // A commercial off-site placement, declared as one.
    expect(mug?.getAttribute("rel")).toBe("sponsored nofollow noopener noreferrer")
  })

  it("tags outbound links so the storefront can attribute the traffic", () => {
    render(<MerchBlock {...makeProps()} />)

    const product = new URL(screen.getByText("DiGG Mug").closest("a")!.getAttribute("href")!)
    expect(product.searchParams.get("utm_source")).toBe("pragmaticpapers")
    expect(product.searchParams.get("utm_medium")).toBe("merch_block")
    expect(product.searchParams.get("utm_content")).toBe("fullWidth_product")

    const store = new URL(screen.getByText("Shop all").closest("a")!.getAttribute("href")!)
    expect(store.searchParams.get("utm_content")).toBe("fullWidth_shop_all")
  })

  it("links 'Shop all' to the store URL", () => {
    render(<MerchBlock {...makeProps()} />)

    const storeLink = screen.getByText("Shop all").closest("a")
    const href = new URL(storeLink?.getAttribute("href") ?? "")
    expect(href.origin + href.pathname).toBe("https://store.example.com/")
    expect(storeLink?.getAttribute("target")).toBe("_blank")
  })

  it("falls back to the default heading and store URL when omitted", () => {
    render(<MerchBlock {...makeProps({ heading: null, storeUrl: null })} />)

    expect(screen.getByRole("heading", { name: "The Pragmatic Papers Store" })).toBeTruthy()
    const href = new URL(screen.getByText("Shop all").closest("a")!.getAttribute("href")!)
    expect(href.origin + href.pathname).toBe("https://pragmaticpapers.org/store")
  })

  it("overlays a badge only on products that have one", () => {
    render(
      <MerchBlock
        {...makeProps({
          products: [
            { id: "1", image, title: "DiGG Mug", badge: "Sold out", url: "https://s.example/mug" },
            { id: "2", image, title: "DiGG Tee", url: "https://s.example/tee" },
          ],
        })}
      />,
    )

    expect(screen.getByText("Sold out")).toBeTruthy()
    expect(screen.queryByText("New")).toBeNull()
  })

  it("renders the badge in a neutral tone, not the brand colour", () => {
    render(
      <MerchBlock
        {...makeProps({
          products: [
            { id: "1", image, title: "DiGG Tee", badge: "Sold out", url: "https://s.example/tee" },
          ],
        })}
      />,
    )

    const badge = screen.getByText("Sold out").className
    expect(badge).toContain("bg-secondary")
    expect(badge).not.toContain("bg-brand")
  })

  it("owns its gutter and closes with a rule as a page-layout block", () => {
    const { container } = render(<MerchBlock {...makeProps()} />)

    const section = container.querySelector("section")!
    expect(section.className).toContain("container")
    expect(container.querySelector('[data-slot="separator"]')).toBeTruthy()
  })

  it("drops the gutter, the rule, and prose styling inside a rich-text column", () => {
    const { container } = render(<MerchBlock {...makeProps()} enableGutter={false} />)

    const section = container.querySelector("section")!
    expect(section.className).not.toContain("container")
    expect(section.className).toContain("not-prose")
    // The surrounding column already separates itself from what follows.
    expect(container.querySelector('[data-slot="separator"]')).toBeNull()
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
})
