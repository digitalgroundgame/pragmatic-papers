import type { Payload } from "payload"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { syncProducts, type ShopifyProductNode } from "@/jobs/syncShopifyProducts/logic"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"

let payload: Payload
let productSeq = 900 // high number to avoid conflicts with other integration tests

const silentLog = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const SYNCED_AT = "2026-08-11T00:00:00.000Z"
const LATER = "2026-08-11T01:00:00.000Z"

beforeAll(async () => {
  payload = await getPayloadConfig()
})

afterAll(async () => {
  await payload.db.destroy?.()
})

afterEach(async () => {
  await payload.delete({
    collection: "merch",
    where: { externalId: { like: "gid://shopify/Product/integration-" } },
    overrideAccess: true,
    context: { disableRevalidate: true },
  })
})

function makeNode(overrides: Partial<ShopifyProductNode> = {}): ShopifyProductNode {
  const seq = ++productSeq
  return {
    id: `gid://shopify/Product/integration-${seq}`,
    title: `Integration Tee ${seq}`,
    handle: `integration-tee-${seq}`,
    description: "An integration test product.",
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

async function findByExternalId(externalId: string) {
  const { docs } = await payload.find({
    collection: "merch",
    where: { externalId: { equals: externalId } },
    limit: 1,
    overrideAccess: true,
  })
  return docs[0]
}

describe("syncProducts", () => {
  it("creates products on a first run", async () => {
    const node = makeNode()

    const counts = await syncProducts(payload, [node], SYNCED_AT, silentLog)

    expect(counts).toMatchObject({ created: 1, updated: 0, archived: 0 })
    const doc = await findByExternalId(node.id)
    expect(doc?.handle).toBe(node.handle)
    expect(doc?.price).toBe("28.00")
    expect(doc?.status).toBe("active")
  })

  it("is idempotent — a second identical run changes nothing", async () => {
    const node = makeNode()
    await syncProducts(payload, [node], SYNCED_AT, silentLog)

    const counts = await syncProducts(payload, [node], LATER, silentLog)

    expect(counts).toMatchObject({ created: 0, updated: 0, archived: 0, unchanged: 1 })
    // The timestamp still moves, so a stale `lastSyncedAt` always means the job
    // stopped running rather than "nothing changed lately".
    const doc = await findByExternalId(node.id)
    expect(doc?.lastSyncedAt).toBe(LATER)
  })

  it("updates a product whose price moved", async () => {
    const node = makeNode()
    await syncProducts(payload, [node], SYNCED_AT, silentLog)

    const counts = await syncProducts(
      payload,
      [{ ...node, priceRange: { minVariantPrice: { amount: "35.00", currencyCode: "USD" } } }],
      LATER,
      silentLog,
    )

    expect(counts).toMatchObject({ updated: 1 })
    expect((await findByExternalId(node.id))?.price).toBe("35.00")
  })

  it("follows a renamed handle, which is what keeps outbound links alive", async () => {
    const node = makeNode()
    await syncProducts(payload, [node], SYNCED_AT, silentLog)

    await syncProducts(payload, [{ ...node, handle: `${node.handle}-2026` }], LATER, silentLog)

    expect((await findByExternalId(node.id))?.handle).toBe(`${node.handle}-2026`)
  })

  it("archives a delisted product instead of deleting it", async () => {
    const kept = makeNode()
    const delisted = makeNode()
    await syncProducts(payload, [kept, delisted], SYNCED_AT, silentLog)

    const counts = await syncProducts(payload, [kept], LATER, silentLog)

    expect(counts).toMatchObject({ archived: 1 })
    const doc = await findByExternalId(delisted.id)
    // Still there — a block holding a relationship to it must not break.
    expect(doc).toBeTruthy()
    expect(doc?.status).toBe("archived")
    expect((await findByExternalId(kept.id))?.status).toBe("active")
  })

  it("leaves editorial fields alone across a sync", async () => {
    const node = makeNode()
    await syncProducts(payload, [node], SYNCED_AT, silentLog)

    const doc = await findByExternalId(node.id)
    await payload.update({
      collection: "merch",
      id: doc!.id,
      data: { featured: true, hidden: true, badgeOverride: "Last few", sortOrder: 3 },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })

    await syncProducts(payload, [{ ...node, title: `${node.title} (2026)` }], LATER, silentLog)

    const after = await findByExternalId(node.id)
    expect(after?.title).toBe(`${node.title} (2026)`)
    expect(after?.featured).toBe(true)
    expect(after?.hidden).toBe(true)
    expect(after?.badgeOverride).toBe("Last few")
    expect(after?.sortOrder).toBe(3)
  })

  it("leaves prior rows intact when Shopify returns nothing but products exist", async () => {
    const node = makeNode()
    await syncProducts(payload, [node], SYNCED_AT, silentLog)

    // An empty catalogue is a legitimate response (everything unpublished), so
    // rows archive rather than vanish.
    const counts = await syncProducts(payload, [], LATER, silentLog)

    expect(counts).toMatchObject({ archived: 1 })
    expect(await findByExternalId(node.id)).toBeTruthy()
  })

  it("restores a product Shopify lists again", async () => {
    const node = makeNode()
    await syncProducts(payload, [node], SYNCED_AT, silentLog)
    await syncProducts(payload, [], LATER, silentLog)
    expect((await findByExternalId(node.id))?.status).toBe("archived")

    const counts = await syncProducts(payload, [node], LATER, silentLog)

    expect(counts).toMatchObject({ updated: 1 })
    expect((await findByExternalId(node.id))?.status).toBe("active")
  })
})
