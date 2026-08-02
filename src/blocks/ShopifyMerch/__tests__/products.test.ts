import { describe, expect, it } from "vitest"

import type { ShopifyMerchBlock } from "@/payload-types"

import { getMerchProducts } from "../products"

type Products = ShopifyMerchBlock["products"]

describe("getMerchProducts", () => {
  it("returns an empty array for null/undefined products", () => {
    expect(getMerchProducts(null)).toEqual([])
    expect(getMerchProducts(undefined)).toEqual([])
  })

  it("normalizes a curated product into the MerchProduct shape", () => {
    const products: Products = [
      { id: "abc", image: 1, title: "DiGG Mug", price: "$15.00", url: "https://store/mug" },
    ]

    expect(getMerchProducts(products)).toEqual([
      { id: "abc", title: "DiGG Mug", price: "$15.00", url: "https://store/mug", image: 1 },
    ])
  })

  it("falls back to an index-based id when the row has none", () => {
    const products: Products = [{ image: 2, title: "Tee", url: "https://store/tee" }]

    expect(getMerchProducts(products).map((p) => p.id)).toEqual(["merch-0"])
  })

  it("coerces blank or whitespace-only prices to null", () => {
    const products: Products = [
      { image: 1, title: "A", price: "   ", url: "https://store/a" },
      { image: 2, title: "B", price: "", url: "https://store/b" },
    ]

    expect(getMerchProducts(products).map((p) => p.price)).toEqual([null, null])
  })

  it("drops entries missing a title or url", () => {
    const products = [
      { image: 1, title: "", url: "https://store/a" },
      { image: 2, title: "B", url: "" },
      { image: 3, title: "Keep", url: "https://store/keep" },
    ] as Products

    expect(getMerchProducts(products).map((p) => p.title)).toEqual(["Keep"])
  })

  it("preserves editor ordering", () => {
    const products: Products = [
      { image: 1, title: "First", url: "https://store/1" },
      { image: 2, title: "Second", url: "https://store/2" },
    ]

    expect(getMerchProducts(products).map((p) => p.title)).toEqual(["First", "Second"])
  })
})
