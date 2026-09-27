import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { Merch as MerchProductDoc, MerchBlock } from "@/payload-types"

import {
  buildProductQuery,
  deriveBadge,
  formatPrice,
  sortFor,
  toMediaShape,
  toMerchProduct,
} from "../products"

function makeDoc(overrides: Partial<MerchProductDoc> = {}): MerchProductDoc {
  return {
    id: 7,
    title: "DGG Mug",
    externalId: "gid://shopify/Product/1",
    source: "shopify",
    handle: "digg-mug",
    price: "15.00",
    currencyCode: "USD",
    availableForSale: true,
    imageUrl: "https://cdn.shopify.com/mug.jpg",
    imageWidth: 800,
    imageHeight: 600,
    imageAlt: "A mug",
    status: "active",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as MerchProductDoc
}

function makeBlock(overrides: Partial<MerchBlock> = {}): MerchBlock {
  return { blockType: "merch", source: "all", ...overrides } as MerchBlock
}

describe("formatPrice", () => {
  it("formats a Shopify amount in its currency", () => {
    expect(formatPrice("15.00", "USD")).toBe("$15.00")
  })

  it("defaults to USD when Shopify omits the currency", () => {
    expect(formatPrice("15.00", null)).toBe("$15.00")
  })

  it("returns null for a missing or non-numeric amount", () => {
    expect(formatPrice(null, "USD")).toBeNull()
    expect(formatPrice("", "USD")).toBeNull()
    expect(formatPrice("free", "USD")).toBeNull()
  })
})

describe("deriveBadge", () => {
  it("marks a sold-out product", () => {
    expect(deriveBadge(makeDoc({ availableForSale: false }))).toBe("Sold Out")
  })

  it("leaves an in-stock product unbadged", () => {
    expect(deriveBadge(makeDoc())).toBeNull()
  })

  it("lets an editor's override win over the derived badge", () => {
    expect(deriveBadge(makeDoc({ availableForSale: false, badgeOverride: "Last few" }))).toBe(
      "Last few",
    )
  })

  it("ignores a whitespace-only override", () => {
    expect(deriveBadge(makeDoc({ availableForSale: false, badgeOverride: "   " }))).toBe("Sold Out")
  })
})

describe("toMediaShape", () => {
  it("presents a remote image as a Media doc ImageMedia can render", () => {
    const media = toMediaShape(makeDoc())

    expect(media?.url).toBe("https://cdn.shopify.com/mug.jpg")
    expect(media?.width).toBe(800)
    expect(media?.height).toBe(600)
    expect(media?.alt).toBe("A mug")
    // Without a mimeType the Media dispatcher never routes this to ImageMedia.
    expect(media?.mimeType).toMatch(/^image\//)
  })

  it("falls back to the product title when Shopify has no alt text", () => {
    expect(toMediaShape(makeDoc({ imageAlt: null }))?.alt).toBe("DGG Mug")
  })

  it("returns null when the product has no image", () => {
    expect(toMediaShape(makeDoc({ imageUrl: null }))).toBeNull()
  })
})

describe("toMerchProduct", () => {
  const STORE = "https://store-site.test/merch"
  const original = process.env.MERCH_SITE_URL

  beforeEach(() => {
    process.env.MERCH_SITE_URL = STORE
  })

  afterEach(() => {
    if (original === undefined) delete process.env.MERCH_SITE_URL
    else process.env.MERCH_SITE_URL = original
  })

  it("links to the configured store site, never the storefront API host", () => {
    const product = toMerchProduct(makeDoc({ handle: "logo-tee" }))

    expect(product?.url).toBe(`${STORE}/logo-tee`)
  })

  it("maps a synced row onto the rendering contract", () => {
    const product = toMerchProduct(makeDoc({ availableForSale: false }))

    expect(product).toMatchObject({
      id: "merch-product-7",
      title: "DGG Mug",
      price: "$15.00",
      badge: "Sold Out",
    })
  })

  it("returns null when no store site is configured, since a card can't link", () => {
    delete process.env.MERCH_SITE_URL

    expect(toMerchProduct(makeDoc())).toBeNull()
  })
})

describe("buildProductQuery", () => {
  it("shows only active, non-hidden products", () => {
    expect(buildProductQuery(makeBlock())).toEqual({
      and: [{ status: { equals: "active" } }, { hidden: { not_equals: true } }],
    })
  })

  it("ignores filter fields when the source is all synced products", () => {
    const query = buildProductQuery(makeBlock({ source: "all", tag: "new", featuredOnly: true }))

    expect(query.and).toHaveLength(2)
  })

  it("narrows by collection, tag, and featured when filtered", () => {
    const query = buildProductQuery(
      makeBlock({
        source: "filtered",
        collection: "apparel",
        tag: "new-release",
        featuredOnly: true,
      }),
    )

    expect(query.and).toContainEqual({ featured: { equals: true } })
    expect(query.and).toContainEqual({ collections: { contains: "apparel" } })
    expect(query.and).toContainEqual({ tags: { contains: "new-release" } })
  })

  it("skips blank filter fields rather than matching on empty strings", () => {
    const query = buildProductQuery(makeBlock({ source: "filtered", collection: "  ", tag: "" }))

    expect(query.and).toHaveLength(2)
  })

  it("restricts to hand-picked products when the editor named some", () => {
    const query = buildProductQuery(makeBlock({ source: "filtered", selectedProducts: [3, 9] }))

    expect(query.and).toContainEqual({ id: { in: [3, 9] } })
  })

  it("accepts populated relationships as well as ids", () => {
    const query = buildProductQuery(
      makeBlock({
        source: "filtered",
        selectedProducts: [makeDoc({ id: 4 }), 9],
      }),
    )

    expect(query.and).toContainEqual({ id: { in: [4, 9] } })
  })
})

describe("sortFor", () => {
  it("maps each ordering onto a Payload sort", () => {
    expect(sortFor({ orderBy: "newest" })).toBe("-createdAt")
    expect(sortFor({ orderBy: "title" })).toBe("title")
    expect(sortFor({ orderBy: "sortOrder" })).toBe("sortOrder")
  })

  it("falls back to sort order when a block predates the field", () => {
    expect(sortFor({ orderBy: null })).toBe("sortOrder")
  })
})
