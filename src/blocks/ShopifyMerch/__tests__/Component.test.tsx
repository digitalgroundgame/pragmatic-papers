import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Media, ShopifyMerchBlock as ShopifyMerchBlockProps } from "@/payload-types"

// `@/components/Media` renders next/image, which needs the Next runtime. Swap
// it for a plain <img>; `isMedia` keeps its real (trivial) semantics.
vi.mock("@/components/Media", () => ({
  isMedia: (media: unknown): boolean => Boolean(media) && typeof media !== "number",
  // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
  Media: ({ media }: { media: Media }) => <img alt={media?.alt ?? "product"} />,
}))

import { ShopifyMerchBlock } from "../Component"

const image = { id: 1, alt: "A mug", mimeType: "image/png", url: "/mug.png" } as unknown as Media

function makeProps(overrides: Partial<ShopifyMerchBlockProps> = {}): ShopifyMerchBlockProps {
  return {
    blockType: "shopifyMerch",
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

describe("ShopifyMerchBlock", () => {
  it("renders nothing when there are no products", () => {
    const { container } = render(<ShopifyMerchBlock {...makeProps({ products: [] })} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the heading and each product's title", () => {
    render(<ShopifyMerchBlock {...makeProps()} />)

    expect(screen.getByRole("heading", { name: "Merch" })).toBeTruthy()
    expect(screen.getByText("DiGG Mug")).toBeTruthy()
    expect(screen.getByText("DiGG Tee")).toBeTruthy()
  })

  it("shows a price only when one is provided", () => {
    render(<ShopifyMerchBlock {...makeProps()} />)

    expect(screen.getByText("$15.00")).toBeTruthy()
    // The tee has no price, so no other price text renders.
    expect(screen.queryAllByText(/^\$/)).toHaveLength(1)
  })

  it("links each product card to its Shopify URL in a new tab", () => {
    render(<ShopifyMerchBlock {...makeProps()} />)

    const mug = screen.getByText("DiGG Mug").closest("a")
    expect(mug?.getAttribute("href")).toBe("https://store.example.com/mug")
    expect(mug?.getAttribute("target")).toBe("_blank")
    expect(mug?.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("renders both store links pointing at the store URL", () => {
    render(<ShopifyMerchBlock {...makeProps()} />)

    const storeLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "https://store.example.com/")
    expect(storeLinks.length).toBe(2)
    expect(screen.getByText("Shop all")).toBeTruthy()
    expect(screen.getByText("Visit the store")).toBeTruthy()
  })

  it("falls back to the default heading and store URL when omitted", () => {
    render(<ShopifyMerchBlock {...makeProps({ heading: null, storeUrl: null })} />)

    expect(screen.getByRole("heading", { name: "From the DiGG Store" })).toBeTruthy()
    const storeLink = screen.getByText("Visit the store").closest("a")
    expect(storeLink?.getAttribute("href")).toBe("https://store.digitalgroundgame.org/")
  })

  it("uses a two-column grid for the square (sidebar) layout", () => {
    render(<ShopifyMerchBlock {...makeProps({ layout: "square" })} />)

    const region = screen.getByRole("region", { name: "Merch" })
    const grid = within(region).getByText("DiGG Mug").closest("div.grid")
    expect(grid?.className).toContain("grid-cols-2")
    expect(grid?.className).not.toContain("lg:grid-cols-4")
  })

  it("uses a wider responsive grid for the full-width layout", () => {
    render(<ShopifyMerchBlock {...makeProps({ layout: "fullWidth" })} />)

    const region = screen.getByRole("region", { name: "Merch" })
    const grid = within(region).getByText("DiGG Mug").closest("div.grid")
    expect(grid?.className).toContain("lg:grid-cols-4")
  })
})
