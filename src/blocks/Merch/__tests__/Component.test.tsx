import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Media, MerchBlock as MerchBlockProps } from "@/payload-types"

import type { MerchProduct } from "../products"

// `@/components/Media` renders next/image, which needs the Next runtime. Swap
// it for a plain <img>; `isMedia` keeps its real (trivial) semantics.
vi.mock("@/components/Media", () => ({
  isMedia: (media: unknown): boolean => Boolean(media) && typeof media !== "number",
  // eslint-disable-next-line @next/next/no-img-element -- test stub, not real markup
  Media: ({ media }: { media: Media }) => <img alt={media?.alt ?? "product"} />,
}))

// The block resolves products through a cached Payload query. This test is
// about rendering, so the data layer is stubbed and covered in products.test.ts.
const getMerchProducts = vi.fn<() => Promise<MerchProduct[]>>()
vi.mock("../products", () => ({
  getMerchProducts: () => getMerchProducts(),
}))

import { MerchBlock } from "../Component"

const image = { id: 1, alt: "A mug", mimeType: "image/png", url: "/mug.png" } as unknown as Media

function makeProducts(overrides: Partial<MerchProduct>[] = []): MerchProduct[] {
  const defaults: MerchProduct[] = [
    {
      id: "1",
      title: "DGG Mug",
      price: "$15.00",
      badge: null,
      url: "https://store-site.test/shop/digg-mug",
      image,
    },
    {
      id: "2",
      title: "DGG Tee",
      price: null,
      badge: null,
      url: "https://store-site.test/shop/digg-tee",
      image,
    },
  ]

  if (!overrides.length) return defaults
  return overrides.map((override, index) => ({
    ...defaults[index % defaults.length]!,
    ...override,
  }))
}

function makeProps(overrides: Partial<MerchBlockProps> = {}): MerchBlockProps {
  return {
    blockType: "merch",
    heading: "Merch",
    layout: "fullWidth",
    source: "all",
    storeUrl: "https://store-site.test/shop",
    ...overrides,
  } as MerchBlockProps
}

/** The block is an async server component, so resolve it before rendering. */
async function renderBlock(
  props: MerchBlockProps,
  options: { enableGutter?: boolean } = {},
): Promise<ReturnType<typeof render>> {
  return render(await MerchBlock({ ...props, ...options }))
}

afterEach(() => {
  cleanup()
  getMerchProducts.mockReset()
})

describe("MerchBlock", () => {
  it("renders nothing when there are no products", async () => {
    getMerchProducts.mockResolvedValue([])

    const { container } = await renderBlock(makeProps())

    expect(container.firstChild).toBeNull()
  })

  it("renders the heading and each product's title", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps())

    expect(screen.getByRole("heading", { name: "Merch" })).toBeTruthy()
    expect(screen.getByText("DGG Mug")).toBeTruthy()
    expect(screen.getByText("DGG Tee")).toBeTruthy()
  })

  it("shows a price only when one is provided", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps())

    expect(screen.getByText("$15.00")).toBeTruthy()
    // The tee has no price, so no other price text renders.
    expect(screen.queryAllByText(/^\$/)).toHaveLength(1)
  })

  it("links each product card to its DGG merch page in a new tab", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps())

    const mug = screen.getByText("DGG Mug").closest("a")
    const href = new URL(mug?.getAttribute("href") ?? "")
    expect(href.origin + href.pathname).toBe("https://store-site.test/shop/digg-mug")
    expect(mug?.getAttribute("target")).toBe("_blank")
    // DGG is our parent org: not a paid placement, not an unendorsed link, and
    // the referrer is left intact for their analytics.
    expect(mug?.getAttribute("rel")).toBe("noopener")
  })

  it("never links a reader to the storefront API host", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    const { container } = await renderBlock(makeProps())

    for (const link of container.querySelectorAll("a")) {
      expect(link.getAttribute("href")).not.toContain("store.digitalgroundgame.org")
    }
  })

  it("tags outbound links so DGG can attribute the traffic", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps())

    const product = new URL(screen.getByText("DGG Mug").closest("a")!.getAttribute("href")!)
    expect(product.searchParams.get("utm_source")).toBe("pragmaticpapers")
    expect(product.searchParams.get("utm_medium")).toBe("merch_block")
    expect(product.searchParams.get("utm_content")).toBe("fullWidth_product")

    const store = new URL(screen.getByText("Shop all").closest("a")!.getAttribute("href")!)
    expect(store.searchParams.get("utm_content")).toBe("fullWidth_shop_all")
  })

  it("marks the store link like the product links — not a paid placement", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps())

    const shopAll = screen.getByText("Shop all").closest("a")
    expect(shopAll?.getAttribute("rel")).toBe("noopener")
    expect(shopAll?.getAttribute("target")).toBe("_blank")
  })

  it("falls back to the default heading when omitted", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps({ heading: null }))

    expect(screen.getByRole("heading", { name: "The Pragmatic Papers Store" })).toBeTruthy()
  })

  it("drops the store button when no store site is configured", async () => {
    // MERCH_SITE_URL is unset in tests, so there's nowhere for "Shop all" to
    // point — better no button than a dead one.
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps({ storeUrl: null }))

    expect(screen.queryByText("Shop all")).toBeNull()
    expect(screen.getByText("DGG Mug")).toBeTruthy()
  })

  it("honours a store URL override", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps({ storeUrl: "https://store-site.test/shop/collections/new" }))

    const href = new URL(screen.getByText("Shop all").closest("a")!.getAttribute("href")!)
    expect(href.pathname).toBe("/shop/collections/new")
  })

  it("overlays a badge only on products that have one", async () => {
    getMerchProducts.mockResolvedValue(makeProducts([{ badge: "Sold Out" }, {}]))

    await renderBlock(makeProps())

    expect(screen.getByText("Sold Out")).toBeTruthy()
    expect(screen.queryByText("New")).toBeNull()
  })

  it("renders the badge in a neutral tone, not the brand colour", async () => {
    getMerchProducts.mockResolvedValue(makeProducts([{ badge: "Sold Out" }]))

    await renderBlock(makeProps())

    const badge = screen.getByText("Sold Out").className
    expect(badge).toContain("bg-secondary")
    expect(badge).not.toContain("bg-brand")
  })

  it("owns its gutter and closes with a rule as a page-layout block", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    const { container } = await renderBlock(makeProps())

    const section = container.querySelector("section")!
    expect(section.className).toContain("container")
    expect(container.querySelector('[data-slot="separator"]')).toBeTruthy()
  })

  it("drops the gutter, the rule, and prose styling inside a rich-text column", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    const { container } = await renderBlock(makeProps(), { enableGutter: false })

    const section = container.querySelector("section")!
    expect(section.className).not.toContain("container")
    expect(section.className).toContain("not-prose")
    expect(container.querySelector('[data-slot="separator"]')).toBeNull()
  })

  it("shows one product at a time for the square (sidebar) layout", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    const { container } = await renderBlock(makeProps({ layout: "square" }))

    const slides = container.querySelectorAll('[aria-roledescription="slide"]')
    expect(slides).toHaveLength(2)
    // No responsive basis overrides — `CarouselItem`'s `basis-full` stands.
    expect(slides[0]?.className).not.toMatch(/basis-1\//)
  })

  it("fans slides out with the viewport for the full-width layout", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    const { container } = await renderBlock(makeProps({ layout: "fullWidth" }))

    const slides = container.querySelectorAll('[aria-roledescription="slide"]')
    expect(slides).toHaveLength(2)
    expect(slides[0]?.className).toContain("sm:basis-1/2")
    expect(slides[0]?.className).toContain("lg:basis-1/4")
  })
})
