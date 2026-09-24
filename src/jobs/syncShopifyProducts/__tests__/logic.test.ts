import { afterEach, describe, expect, it, vi } from "vitest"

import type { Merch as MerchProductDoc } from "@/payload-types"
import type { Payload } from "payload"

import {
  didChange,
  fetchShopifyProducts,
  hasProductChanged,
  mapShopifyProduct,
  MAX_PAGES,
  buildProductsQuery,
  normalizeDomain,
  readShopifyEnv,
  storefrontEndpoint,
  syncProducts,
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

/**
 * The two shapes `syncProducts` queries with: one product by its store id, and
 * every row still marked active.
 */
interface MerchWhere {
  externalId?: { equals: string }
  status?: { equals: string }
}

interface FakePayload {
  payload: Payload
  rows: MerchProductDoc[]
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

/**
 * An in-memory stand-in for the Local API, covering only what `syncProducts`
 * calls. The integration suite runs the same code against a real database; this
 * is for the branches that are awkward to provoke there — an unchanged row, a
 * product that vanishes from Shopify — and for asserting *how* the writes are
 * made, which a database can't show you.
 */
function fakePayload(rows: MerchProductDoc[] = []): FakePayload {
  let nextId = rows.length + 1

  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const row = { id: nextId++, ...data } as unknown as MerchProductDoc
    rows.push(row)
    return row
  })

  const update = vi.fn(async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
    const row = rows.find((candidate) => candidate.id === id)
    Object.assign(row as object, data)
    return row
  })

  const find = vi.fn(async ({ where }: { where: MerchWhere }) => {
    const externalId = where.externalId?.equals
    if (externalId) {
      const match = rows.find((row) => row.externalId === externalId)
      return { docs: match ? [match] : [] }
    }
    return { docs: rows.filter((row) => row.status === where.status?.equals) }
  })

  return { payload: { create, update, find } as unknown as Payload, rows, create, update }
}

function makeRow(overrides: Partial<MerchProductDoc> = {}): MerchProductDoc {
  return {
    ...mapShopifyProduct(makeNode(), SYNCED_AT),
    id: 1,
    updatedAt: SYNCED_AT,
    createdAt: SYNCED_AT,
    ...overrides,
  } as MerchProductDoc
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

  it("returns null when the domain is set but unusable", () => {
    // Distinct from "unset": all three vars are present, so the run would
    // otherwise proceed and build a nonsense endpoint.
    process.env.SHOPIFY_STORE_DOMAIN = "http://"
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "shpat_test"
    process.env.SHOPIFY_API_VERSION = "2026-07"

    expect(readShopifyEnv()).toBeNull()
  })

  it("accepts a pasted store URL, not just a bare host", () => {
    // The endpoint builder prefixes https://, so a scheme here used to produce
    // https://https://store… and fail as an opaque "fetch failed".
    process.env.SHOPIFY_STORE_DOMAIN = "https://store.example.org/"
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "shpat_test"
    process.env.SHOPIFY_API_VERSION = "2025-01"

    expect(readShopifyEnv()).toEqual(config)
  })
})

describe("normalizeDomain", () => {
  it("reduces anything paste-shaped to a bare host", () => {
    for (const input of [
      "store.example.org",
      "  store.example.org  ",
      "https://store.example.org",
      "http://store.example.org/",
      "https://store.example.org/collections/all",
    ]) {
      expect(normalizeDomain(input)).toBe("store.example.org")
    }
  })

  it("keeps a non-default port, which a host is allowed to carry", () => {
    expect(normalizeDomain("http://localhost:9000")).toBe("localhost:9000")
  })

  it("returns null for a URL that parses but names no host", () => {
    // A scheme survives the parse, so this can't be caught by try/catch alone.
    expect(normalizeDomain("file:///etc/hosts")).toBeNull()
  })

  it("returns null for something unparseable, rather than a nonsense host", () => {
    expect(normalizeDomain("   ")).toBeNull()
    expect(normalizeDomain("https://")).toBeNull()
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

  it("names the endpoint and the cause when the network fails", async () => {
    // Node reports every network failure as a bare "fetch failed", which can't
    // be told apart from a bad URL or blocked egress in a log.
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND store") })
    }) as unknown as typeof fetch

    await expect(fetchShopifyProducts(config, silentLog, fetchImpl)).rejects.toThrow(
      /store\.example\.org\/api\/2025-01\/graphql\.json.*ENOTFOUND/,
    )
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

  it("still fails loudly when GraphQL reports an error with no message", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ errors: [{}] }),
    })) as unknown as typeof fetch

    await expect(fetchShopifyProducts(config, silentLog, fetchImpl)).rejects.toThrow(
      "Shopify request failed",
    )
  })

  it("treats a response carrying no nodes as an empty page, not a crash", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: { products: { pageInfo: { hasNextPage: false } } } }),
    })) as unknown as typeof fetch

    await expect(fetchShopifyProducts(config, silentLog, fetchImpl)).resolves.toEqual([])
  })

  it("rethrows a non-Error failure rather than mistaking it for a scope problem", async () => {
    // Only the `fetch` call is wrapped, so anything thrown while reading the
    // body arrives at the scope check raw — including a bare string.
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => {
        throw "socket hang up"
      },
    })) as unknown as typeof fetch

    await expect(fetchShopifyProducts(config, silentLog, fetchImpl)).rejects.toBe("socket hang up")
  })

  it("stops paginating rather than following a looping cursor forever", async () => {
    // A store that always claims another page would otherwise pin the worker.
    const endless = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          products: {
            nodes: [makeNode()],
            pageInfo: { hasNextPage: true, endCursor: "always-more" },
          },
        },
      }),
    })) as unknown as typeof fetch
    const log = { ...silentLog, warn: vi.fn() }

    const products = await fetchShopifyProducts(config, log, endless)

    expect(endless).toHaveBeenCalledTimes(MAX_PAGES)
    expect(products).toHaveLength(MAX_PAGES)
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("stopped paginating"))
  })

  it("reports a bare network failure without inventing a cause", async () => {
    const failing = vi.fn(async () => {
      throw new Error("fetch failed")
    }) as unknown as typeof fetch

    await expect(fetchShopifyProducts(config, silentLog, failing)).rejects.toThrow(
      /Could not reach the Shopify Storefront API at https:\/\/store\.example\.org[^(]*$/,
    )
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
      collections: ["apparel"],
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

  it("nulls every absent field rather than dropping it from the row", () => {
    // Shopify omits what a product doesn't have. Storing null keeps the column
    // meaningful — "the store has nothing here" — and lets the next run fill it.
    const sparse = mapShopifyProduct(
      { id: "gid://shopify/Product/9", title: "Bare", handle: "bare" } as ShopifyProductNode,
      SYNCED_AT,
    )

    expect(sparse).toMatchObject({
      description: null,
      price: null,
      compareAtPrice: null,
      currencyCode: null,
      availableForSale: null,
      imageUrl: null,
      imageWidth: null,
      imageHeight: null,
      imageAlt: null,
      status: "active",
    })
    // Lists stay lists, so a filtering block gets an empty match, not a crash.
    expect(sparse.tags).toEqual([])
    expect(sparse.collections).toEqual([])
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

  it("treats a null list and an empty one as the same thing", () => {
    // Payload stores an empty `hasMany` as null; Shopify sends `[]`. Reading
    // that as a change would rewrite untagged products on every run.
    const untagged = { ...makeRow(), tags: null, collections: null } as MerchProductDoc
    const next = mapShopifyProduct(makeNode({ tags: [], collections: { nodes: [] } }), SYNCED_AT)

    expect(hasProductChanged(untagged, next)).toBe(false)
  })

  it("compares tag lists by value, not identity", () => {
    const unchanged = mapShopifyProduct(makeNode({ tags: ["apparel"] }), SYNCED_AT)
    const changed = mapShopifyProduct(makeNode({ tags: ["apparel", "new"] }), SYNCED_AT)

    expect(hasProductChanged(existing, unchanged)).toBe(false)
    expect(hasProductChanged(existing, changed)).toBe(true)
  })
})

describe("syncProducts", () => {
  const LATER = "2026-08-12T00:00:00.000Z"

  it("creates a product the store has and we don't", async () => {
    const { payload, rows, create } = fakePayload()

    const counts = await syncProducts(payload, [makeNode()], SYNCED_AT, silentLog)

    expect(counts).toMatchObject({ created: 1, updated: 0, archived: 0, unchanged: 0 })
    expect(rows[0]).toMatchObject({ externalId: "gid://shopify/Product/1", title: "Logo Tee" })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("updates a product whose store data moved", async () => {
    const { payload, rows } = fakePayload([makeRow()])

    const counts = await syncProducts(
      payload,
      [makeNode({ priceRange: { minVariantPrice: { amount: "30.00", currencyCode: "USD" } } })],
      LATER,
      silentLog,
    )

    expect(counts).toMatchObject({ created: 0, updated: 1, unchanged: 0 })
    expect(rows[0]?.price).toBe("30.00")
  })

  it("re-stamps an unchanged product without counting it as a change", async () => {
    // A stale `lastSyncedAt` has to mean the job stopped running, never
    // "nothing moved lately" — otherwise it's useless as a health signal.
    const { payload, rows, update } = fakePayload([makeRow()])

    const counts = await syncProducts(payload, [makeNode()], LATER, silentLog)

    expect(counts).toMatchObject({ unchanged: 1, updated: 0, created: 0 })
    expect(rows[0]?.lastSyncedAt).toBe(LATER)
    expect(update.mock.calls[0]?.[0].data).toEqual({ lastSyncedAt: LATER })
  })

  it("archives a product the store no longer lists rather than deleting it", async () => {
    // A block may hold a relationship to it; archived degrades to "not shown",
    // a delete would leave a dangling reference.
    const { payload, rows } = fakePayload([makeRow({ id: 1, title: "Discontinued Tee" })])

    const counts = await syncProducts(payload, [], LATER, silentLog)

    expect(counts).toMatchObject({ archived: 1, created: 0, updated: 0 })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe("archived")
  })

  it("leaves rows that are already archived alone", async () => {
    const { payload, update } = fakePayload([makeRow({ status: "archived" })])

    const counts = await syncProducts(payload, [], LATER, silentLog)

    expect(counts.archived).toBe(0)
    expect(update).not.toHaveBeenCalled()
  })

  it("never writes the editorial fields, so curating a product survives a sync", async () => {
    const { payload, create } = fakePayload()

    await syncProducts(payload, [makeNode()], SYNCED_AT, silentLog)

    const written = Object.keys(create.mock.calls[0]?.[0].data ?? {})
    expect(written).not.toContain("featured")
    expect(written).not.toContain("hidden")
    expect(written).not.toContain("badgeOverride")
    expect(written).not.toContain("sortOrder")
  })

  it("suppresses per-row revalidation, deciding once for the whole run", async () => {
    const { payload, create } = fakePayload()

    await syncProducts(payload, [makeNode()], SYNCED_AT, silentLog)

    expect(create.mock.calls[0]?.[0].context).toEqual({ disableRevalidate: true })
  })

  it("handles a mixed run in one pass", async () => {
    const { payload } = fakePayload([
      makeRow({ id: 1 }),
      makeRow({ id: 2, externalId: "gid://shopify/Product/2", handle: "gone", title: "Gone" }),
    ])

    const counts = await syncProducts(
      payload,
      [makeNode(), makeNode({ id: "gid://shopify/Product/3", handle: "new-mug", title: "Mug" })],
      LATER,
      silentLog,
    )

    expect(counts).toEqual({ created: 1, updated: 0, archived: 1, unchanged: 1 })
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
