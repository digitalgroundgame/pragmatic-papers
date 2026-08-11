import { afterEach, describe, expect, it, vi } from "vitest"

import type { Merch as MerchProductDoc } from "@/payload-types"

import {
  didChange,
  fetchShopifyProducts,
  hasProductChanged,
  mapShopifyProduct,
  buildProductsQuery,
  readShopifyEnv,
  storefrontEndpoint,
  type ShopifyProductNode,
} from "../logic"

const SYNCED_AT = "2026-08-11T00:00:00.000Z"

const config = { domain: "store.example.org", token: "shpat_test", apiVersion: "2025-01" }

const silentLog = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

function makeNode(overrides: Partial<ShopifyProductNode> = {}): ShopifyProductNode {
  return {
    id: "gid://shopify/Product/1",
    title: "Logo Tee",
    handle: "logo-tee",
    description: "A tee.",
    tags: ["apparel"],
    availableForSale: true,
    featuredImage: {
      url: "https://cdn.shopify.com/tee.jpg",
      altText: "A tee",
      width: 1000,
      height: 1000,
    },
    priceRange: { minVariantPrice: { amount: "28.00", currencyCode: "USD" } },
    collections: { nodes: [{ handle: "apparel" }] },
    ...overrides,
  }
}

/** A fetch stub returning one GraphQL page per call. */
function stubFetch(pages: { nodes: ShopifyProductNode[]; next?: string }[]): typeof fetch {
  let call = 0
  return vi.fn(async () => {
    const page = pages[call]
    call += 1
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          products: {
            nodes: page?.nodes ?? [],
            pageInfo: { hasNextPage: Boolean(page?.next), endCursor: page?.next ?? null },
          },
        },
      }),
    }
  }) as unknown as typeof fetch
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.SHOPIFY_STORE_DOMAIN
  delete process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN
  delete process.env.SHOPIFY_API_VERSION
})

describe("readShopifyEnv", () => {
  it("returns null when credentials are absent, so dev and CI skip quietly", () => {
    expect(readShopifyEnv()).toBeNull()
  })

  it("returns null when only some credentials are set", () => {
    process.env.SHOPIFY_STORE_DOMAIN = "store.example.org"

    expect(readShopifyEnv()).toBeNull()
  })

  it("reads a complete credential set", () => {
    process.env.SHOPIFY_STORE_DOMAIN = "store.example.org"
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "shpat_test"
    process.env.SHOPIFY_API_VERSION = "2025-01"

    expect(readShopifyEnv()).toEqual(config)
  })
})

describe("storefrontEndpoint", () => {
  it("builds the versioned GraphQL endpoint", () => {
    expect(storefrontEndpoint(config)).toBe("https://store.example.org/api/2025-01/graphql.json")
  })
})

describe("fetchShopifyProducts", () => {
  it("walks past the first page instead of stopping at one batch", async () => {
    const fetchImpl = stubFetch([
      { nodes: [makeNode()], next: "cursor-1" },
      { nodes: [makeNode({ id: "gid://shopify/Product/2", handle: "mug" })] },
    ])

    const products = await fetchShopifyProducts(config, silentLog, fetchImpl)

    expect(products.map((p) => p.handle)).toEqual(["logo-tee", "mug"])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("passes the cursor and the storefront token", async () => {
    const fetchImpl = stubFetch([{ nodes: [makeNode()], next: "cursor-1" }, { nodes: [] }])

    await fetchShopifyProducts(config, silentLog, fetchImpl)

    const [, secondCall] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } })
      .mock.calls
    const headers = secondCall![1].headers as Record<string, string>
    expect(headers["X-Shopify-Storefront-Access-Token"]).toBe("shpat_test")
    expect(JSON.parse(secondCall![1].body as string).variables.after).toBe("cursor-1")
  })

  it("throws on an HTTP error so the job retries rather than wiping the catalogue", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({}),
    })) as unknown as typeof fetch

    await expect(fetchShopifyProducts(config, silentLog, fetchImpl)).rejects.toThrow(/503/)
  })

  it("throws when GraphQL reports an error despite a 200", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ errors: [{ message: "Invalid access token" }] }),
    })) as unknown as typeof fetch

    await expect(fetchShopifyProducts(config, silentLog, fetchImpl)).rejects.toThrow(
      "Invalid access token",
    )
  })

  it("retries without collections when the token isn't scoped for them", async () => {
    let call = 0
    const fetchImpl = vi.fn(async () => {
      call += 1
      // First query (with collections) is rejected for scope; the retry succeeds.
      if (call === 1) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            errors: [{ message: "Access denied for collections field" }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          data: {
            products: {
              nodes: [makeNode({ collections: null })],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }),
      }
    }) as unknown as typeof fetch

    const products = await fetchShopifyProducts(config, silentLog, fetchImpl)

    expect(products).toHaveLength(1)
    const retryBody = JSON.parse(
      (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[1]![1]
        .body as string,
    )
    expect(retryBody.query).not.toContain("collections(")
  })

  it("does not retry an outage as if it were a scope problem", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({}),
    })) as unknown as typeof fetch

    await expect(fetchShopifyProducts(config, silentLog, fetchImpl)).rejects.toThrow(/503/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe("buildProductsQuery", () => {
  it("asks for the fields the sync maps, plus cursor pagination", () => {
    const query = buildProductsQuery()

    for (const field of [
      "pageInfo { hasNextPage endCursor }",
      "tags",
      "availableForSale",
      "featuredImage { url altText width height }",
      "priceRange { minVariantPrice { amount currencyCode } }",
      "compareAtPriceRange { maxVariantPrice { amount } }",
      "collections(first: 10) { nodes { handle } }",
    ]) {
      expect(query).toContain(field)
    }
  })

  it("can drop collections, the one field a storefront token may not be scoped for", () => {
    const query = buildProductsQuery({ withCollections: false })

    expect(query).not.toContain("collections(")
    expect(query).toContain("tags")
  })
})

describe("mapShopifyProduct", () => {
  it("maps a Storefront product onto the fields a sync owns", () => {
    expect(mapShopifyProduct(makeNode(), SYNCED_AT)).toEqual({
      externalId: "gid://shopify/Product/1",
      source: "shopify",
      title: "Logo Tee",
      handle: "logo-tee",
      description: "A tee.",
      price: "28.00",
      compareAtPrice: null,
      currencyCode: "USD",
      availableForSale: true,
      imageUrl: "https://cdn.shopify.com/tee.jpg",
      imageWidth: 1000,
      imageHeight: 1000,
      imageAlt: "A tee",
      tags: ["apparel"],
      categories: ["apparel"],
      status: "active",
      lastSyncedAt: SYNCED_AT,
    })
  })

  it("stores prices as Shopify reports them, formatting nothing", () => {
    const node = makeNode({ compareAtPriceRange: { maxVariantPrice: { amount: "35.00" } } })
    const mapped = mapShopifyProduct(node, SYNCED_AT)

    expect(mapped.price).toBe("28.00")
    expect(mapped.compareAtPrice).toBe("35.00")
    expect(mapped.currencyCode).toBe("USD")
  })

  it("keeps Shopify's zero compare-at rather than deciding what it means", () => {
    const node = makeNode({ compareAtPriceRange: { maxVariantPrice: { amount: "0.0" } } })

    // "0.0" means never-on-sale, but that reading belongs to the block: baking
    // it in here would need a re-sync to change.
    expect(mapShopifyProduct(node, SYNCED_AT).compareAtPrice).toBe("0.0")
  })

  it("passes unknown availability through instead of guessing", () => {
    const node = makeNode({ availableForSale: null })

    expect(mapShopifyProduct(node, SYNCED_AT).availableForSale).toBeNull()
  })
})

describe("hasProductChanged", () => {
  const existing = {
    ...mapShopifyProduct(makeNode(), SYNCED_AT),
    id: 1,
  } as unknown as MerchProductDoc

  it("ignores a run that only moved the sync timestamp", () => {
    const next = mapShopifyProduct(makeNode(), "2026-08-11T01:00:00.000Z")

    expect(hasProductChanged(existing, next)).toBe(false)
  })

  it("notices a price change", () => {
    const next = mapShopifyProduct(
      makeNode({ priceRange: { minVariantPrice: { amount: "30.00", currencyCode: "USD" } } }),
      SYNCED_AT,
    )

    expect(hasProductChanged(existing, next)).toBe(true)
  })

  it("notices a product selling out", () => {
    const next = mapShopifyProduct(makeNode({ availableForSale: false }), SYNCED_AT)

    expect(hasProductChanged(existing, next)).toBe(true)
  })

  it("notices a renamed handle, which is what keeps outbound links alive", () => {
    const next = mapShopifyProduct(makeNode({ handle: "logo-tee-2026" }), SYNCED_AT)

    expect(hasProductChanged(existing, next)).toBe(true)
  })

  it("compares tag lists by value, not identity", () => {
    const unchanged = mapShopifyProduct(makeNode({ tags: ["apparel"] }), SYNCED_AT)
    const changed = mapShopifyProduct(makeNode({ tags: ["apparel", "new"] }), SYNCED_AT)

    expect(hasProductChanged(existing, unchanged)).toBe(false)
    expect(hasProductChanged(existing, changed)).toBe(true)
  })
})

describe("didChange", () => {
  it("is false for a run that only re-stamped existing rows", () => {
    expect(didChange({ created: 0, updated: 0, archived: 0, unchanged: 12 })).toBe(false)
  })

  it("is true when anything was created, updated, or archived", () => {
    expect(didChange({ created: 1, updated: 0, archived: 0, unchanged: 0 })).toBe(true)
    expect(didChange({ created: 0, updated: 1, archived: 0, unchanged: 0 })).toBe(true)
    expect(didChange({ created: 0, updated: 0, archived: 1, unchanged: 0 })).toBe(true)
  })
})
