import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

// Where "Shop all" points is config, not content — the block reads it from the
// environment, so the tests set it the same way production does.
const originalStoreUrl = process.env.MERCH_SITE_URL

beforeEach(() => {
  process.env.MERCH_SITE_URL = "https://store-site.test/shop"
})

afterEach(() => {
  cleanup()
  getMerchProducts.mockReset()
  if (originalStoreUrl === undefined) delete process.env.MERCH_SITE_URL
  else process.env.MERCH_SITE_URL = originalStoreUrl
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

  it("renders no heading at all when one isn't set", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    const { container } = await renderBlock(makeProps({ heading: null }))

    expect(screen.queryByRole("heading")).toBeNull()
    // The section takes its accessible name from the heading, so without one it
    // is an unnamed section rather than a section labelled with a stand-in.
    expect(container.querySelector("section")?.hasAttribute("aria-label")).toBe(false)
    expect(screen.getByText("DGG Mug")).toBeTruthy()
  })

  it("treats a heading cleared to whitespace as unset", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps({ heading: "   " }))

    expect(screen.queryByRole("heading")).toBeNull()
  })

  it("drops the store button when no store site is configured", async () => {
    // Without MERCH_SITE_URL there's nowhere for "Shop all" to point — better
    // no button than a dead one.
    delete process.env.MERCH_SITE_URL
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps())

    expect(screen.queryByText("Shop all")).toBeNull()
    expect(screen.getByText("DGG Mug")).toBeTruthy()
  })

  it("points the store button at the configured site, not a per-block value", async () => {
    getMerchProducts.mockResolvedValue(makeProducts())

    await renderBlock(makeProps())

    const href = new URL(screen.getByText("Shop all").closest("a")!.getAttribute("href")!)
    expect(href.origin + href.pathname).toBe("https://store-site.test/shop")
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
    expect(badge).not.toContain("bg-brand")
    // Not `bg-secondary`: it resolves to the same value as the card's own
    // `bg-muted`, which left the badge invisible behind a transparent product
    // shot. `bg-primary` is the solid neutral that contrasts in both themes.
    expect(badge).toContain("bg-primary")
    expect(badge).not.toContain("bg-secondary")
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
