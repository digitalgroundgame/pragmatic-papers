import type { Payload } from "payload"

import type { Merch as MerchProductDoc } from "@/payload-types"

/** How many products to pull per Storefront request. */
export const PAGE_SIZE = 50

/**
 * Hard stop on pagination. The catalog is a few dozen products; anything past
 * this means a cursor loop, and we'd rather log and bail than spin forever.
 */
export const MAX_PAGES = 20

export interface Logger {
  debug: (msg: string) => void
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string) => void
}

export interface ShopifyConfig {
  domain: string
  token: string
  apiVersion: string
}

/** A product as it comes back from the Storefront API. */
export interface ShopifyProductNode {
  id: string
  title: string
  handle: string
  description?: string | null
  tags?: string[] | null
  availableForSale?: boolean | null
  featuredImage?: {
    url?: string | null
    altText?: string | null
    width?: number | null
    height?: number | null
  } | null
  priceRange?: {
    minVariantPrice?: { amount?: string | null; currencyCode?: string | null } | null
  } | null
  compareAtPriceRange?: { maxVariantPrice?: { amount?: string | null } | null } | null
  collections?: { nodes?: { handle: string }[] | null } | null
}

/** The subset of a `merch` row that a sync owns. */
export type SyncedProductData = Pick<
  MerchProductDoc,
  | "externalId"
  | "source"
  | "title"
  | "handle"
  | "description"
  | "price"
  | "compareAtPrice"
  | "currencyCode"
  | "availableForSale"
  | "imageUrl"
  | "imageWidth"
  | "imageHeight"
  | "imageAlt"
  | "tags"
  | "collections"
  | "status"
  | "lastSyncedAt"
>

export interface SyncCounts {
  created: number
  updated: number
  archived: number
  unchanged: number
}

/**
 * The Storefront query. Wider than the one dgg-frontpage runs for its own store
 * page: it pages through the whole catalog rather than taking the first 24, and
 * it asks for the tags, collections, and image dimensions we need — tags and
 * collections so blocks can filter, dimensions because `next/image` needs an
 * intrinsic size for a remote file.
 *
 * Product-level `availableForSale` and `priceRange` stand in for walking every
 * variant: we show a card, not a variant picker.
 *
 * `collections` needs the `unauthenticated_read_product_listings` scope, which
 * a storefront token doesn't necessarily carry — and one unauthorized field
 * fails the whole query. Hence the toggle: see `fetchShopifyProducts`, which
 * drops it and retries rather than letting a scope gap stop the sync.
 */
export function buildProductsQuery({ withCollections = true } = {}): string {
  return `query MerchProducts($first: Int!, $after: String) {
  products(first: $first, after: $after, sortKey: TITLE) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      handle
      description
      tags
      availableForSale
      featuredImage { url altText width height }
      priceRange { minVariantPrice { amount currencyCode } }
      compareAtPriceRange { maxVariantPrice { amount } }${
        withCollections ? "\n      collections(first: 10) { nodes { handle } }" : ""
      }
    }
  }
}`
}

/**
 * Errors worth retrying without the `collections` field. A scope the token
 * lacks reads as an access error on that field; anything else (an outage, a bad
 * token) would fail the same way a second time.
 */
const COLLECTIONS_SCOPE_ERROR = /collection|access denied|not authorized|unauthorized/i

/**
 * Reduce whatever's in the env var to a bare host.
 *
 * "store.example.org" is what the endpoint builder wants, but pasting the
 * store URL out of a browser is the obvious thing to do, and
 * `https://https://store…` fails as an opaque "fetch failed" an hour later
 * rather than at the point of configuration.
 *
 * Parsing rather than trimming strings keeps the awkward cases honest — a
 * port survives, a path or credentials don't — and anything unparseable
 * returns null so the run reports a bad configuration instead of chasing a
 * nonsense URL.
 */
export function normalizeDomain(domain: string): string | null {
  const trimmed = domain.trim()
  if (!trimmed) return null

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)

  try {
    // `host`, not `hostname`, so a non-default port is preserved.
    return new URL(hasScheme ? trimmed : `https://${trimmed}`).host || null
  } catch {
    return null
  }
}

/**
 * Read Shopify credentials.
 *
 * Returns null rather than throwing when they're absent: dev and CI have no
 * store credentials, and a missing integration should skip the run quietly, not
 * fail the queue and burn retries.
 */
export function readShopifyEnv(): ShopifyConfig | null {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN
  const apiVersion = process.env.SHOPIFY_API_VERSION

  if (!domain || !token || !apiVersion) return null

  const host = normalizeDomain(domain)
  if (!host) return null

  return { domain: host, token, apiVersion }
}

export function storefrontEndpoint({ domain, apiVersion }: ShopifyConfig): string {
  return new URL(`/api/${encodeURIComponent(apiVersion)}/graphql.json`, `https://${domain}`).href
}

/**
 * Page through the catalog.
 *
 * `fetchImpl` is injectable so tests exercise pagination without a network.
 */
async function fetchPages(
  config: ShopifyConfig,
  query: string,
  log: Logger,
  fetchImpl: typeof fetch,
): Promise<ShopifyProductNode[]> {
  const endpoint = storefrontEndpoint(config)
  const products: ShopifyProductNode[] = []
  let cursor: string | null = null
  let page = 0

  while (page < MAX_PAGES) {
    page += 1

    let response: Awaited<ReturnType<typeof fetchImpl>>
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": config.token,
        },
        body: JSON.stringify({
          query,
          variables: { first: PAGE_SIZE, after: cursor },
        }),
      })
    } catch (err) {
      // Node reports every network failure as a bare "fetch failed"; without
      // the endpoint and the cause, a DNS miss, a blocked egress and a
      // malformed URL are indistinguishable in the logs.
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : ""
      throw new Error(
        `Could not reach the Shopify Storefront API at ${endpoint}${cause ? ` (${cause})` : ""}`,
        { cause: err },
      )
    }

    if (!response.ok) {
      throw new Error(`Shopify Storefront API responded ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as {
      data?: {
        products?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
          nodes?: ShopifyProductNode[]
        }
      }
      errors?: { message: string }[]
    }

    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message ?? "Shopify request failed")
    }

    const batch = payload.data?.products?.nodes ?? []
    products.push(...batch)
    log.debug(`[merch-sync]   page ${page}: ${batch.length} products (${products.length} total)`)

    const pageInfo = payload.data?.products?.pageInfo
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) return products
    cursor = pageInfo.endCursor
  }

  log.warn(`[merch-sync] stopped paginating at ${MAX_PAGES} pages — is the cursor looping?`)
  return products
}

/**
 * Page through the catalog.
 *
 * `fetchImpl` is injectable so tests exercise pagination without a network.
 */
export async function fetchShopifyProducts(
  config: ShopifyConfig,
  log: Logger,
  fetchImpl: typeof fetch = fetch,
): Promise<ShopifyProductNode[]> {
  try {
    return await fetchPages(config, buildProductsQuery(), log, fetchImpl)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!COLLECTIONS_SCOPE_ERROR.test(message)) throw err

    // Losing collection filters is survivable; losing the catalogue isn't.
    log.warn(
      `[merch-sync] collections unavailable (${message}) — retrying without them; blocks filtering by Shopify collection will match nothing`,
    )
    return await fetchPages(config, buildProductsQuery({ withCollections: false }), log, fetchImpl)
  }
}

/**
 * Map a Storefront product onto the fields a sync owns.
 *
 * Deliberately a transcription, not an interpretation: values land as Shopify
 * reports them — amount and currency apart, image URL and its dimensions, the
 * raw availability flag — and the block decides how any of it reads. A sync
 * that formats a price or decides what counts as "on sale" bakes a display
 * choice into the database, where changing it later means a re-sync.
 *
 * Fields are flat leaf values rather than a mirror of the response: the nesting
 * Shopify returns (`priceRange.minVariantPrice`, `collections { nodes }`) is
 * GraphQL transport, not its data model, and this table is a derived cache —
 * anything we skip today can be added as a column and backfilled by the next
 * hourly run.
 */
export function mapShopifyProduct(node: ShopifyProductNode, syncedAt: string): SyncedProductData {
  const price = node.priceRange?.minVariantPrice

  return {
    externalId: node.id,
    source: "shopify",
    title: node.title,
    handle: node.handle,
    description: node.description ?? null,
    price: price?.amount ?? null,
    // Shopify reports "0.0" for products that were never on sale. Stored as
    // given; the block is what decides that isn't a struck-through price.
    compareAtPrice: node.compareAtPriceRange?.maxVariantPrice?.amount ?? null,
    currencyCode: price?.currencyCode ?? null,
    availableForSale: node.availableForSale ?? null,
    imageUrl: node.featuredImage?.url ?? null,
    imageWidth: node.featuredImage?.width ?? null,
    imageHeight: node.featuredImage?.height ?? null,
    imageAlt: node.featuredImage?.altText ?? null,
    tags: node.tags ?? [],
    // Shopify collections — the store's product groupings, stored by handle.
    // Not Payload collections, despite the word.
    collections: node.collections?.nodes?.map((collection) => collection.handle) ?? [],
    status: "active",
    lastSyncedAt: syncedAt,
  }
}

/**
 * Whether a mapped product differs from the row we already hold.
 *
 * `lastSyncedAt` is deliberately excluded — it changes every run, and treating
 * that as a change would revalidate the whole site hourly for nothing.
 */
export function hasProductChanged(existing: MerchProductDoc, next: SyncedProductData): boolean {
  const keys = Object.keys(next).filter(
    (key) => key !== "lastSyncedAt",
  ) as (keyof SyncedProductData)[]

  return keys.some((key) => {
    const before = existing[key as keyof MerchProductDoc]
    const after = next[key]

    if (Array.isArray(before) || Array.isArray(after)) {
      return JSON.stringify(before ?? []) !== JSON.stringify(after ?? [])
    }
    // Payload normalizes absent values to null; `undefined` from the API means
    // the same thing.
    return (before ?? null) !== (after ?? null)
  })
}

/**
 * Upsert the catalogue into `merch` and archive whatever Shopify no
 * longer lists.
 *
 * Editorial fields (`featured`, `hidden`, `badgeOverride`, `sortOrder`) are
 * never part of the written payload, so curating a product survives every run.
 */
export async function syncProducts(
  payload: Payload,
  nodes: ShopifyProductNode[],
  syncedAt: string,
  log: Logger,
): Promise<SyncCounts> {
  const counts: SyncCounts = { created: 0, updated: 0, archived: 0, unchanged: 0 }
  const seenExternalIds = new Set<string>()

  for (const node of nodes) {
    const data = mapShopifyProduct(node, syncedAt)
    seenExternalIds.add(data.externalId)

    const existing = await payload.find({
      collection: "merch",
      where: { externalId: { equals: data.externalId } },
      limit: 1,
      overrideAccess: true,
      // Revalidation is decided once at the end of the run, not per row.
      context: { disableRevalidate: true },
    })

    const current = existing.docs[0]

    if (!current) {
      await payload.create({
        collection: "merch",
        data,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      counts.created += 1
      continue
    }

    if (!hasProductChanged(current, data)) {
      // Still stamp the sync time so a stale `lastSyncedAt` always means the
      // job stopped running, never "nothing changed lately".
      await payload.update({
        collection: "merch",
        id: current.id,
        data: { lastSyncedAt: syncedAt },
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      counts.unchanged += 1
      continue
    }

    await payload.update({
      collection: "merch",
      id: current.id,
      data,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    counts.updated += 1
  }

  // Anything active we didn't see this run is gone from Shopify. Archive it —
  // never delete, so blocks holding a relationship to it don't break.
  const stale = await payload.find({
    collection: "merch",
    where: { status: { equals: "active" } },
    limit: 0,
    overrideAccess: true,
    context: { disableRevalidate: true },
  })

  for (const product of stale.docs) {
    if (seenExternalIds.has(product.externalId)) continue

    log.info(`[merch-sync]   archiving "${product.title}" — no longer listed on Shopify`)
    await payload.update({
      collection: "merch",
      id: product.id,
      data: { status: "archived", lastSyncedAt: syncedAt },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    counts.archived += 1
  }

  return counts
}

/** Did this run change anything a reader would see? */
export function didChange({ created, updated, archived }: SyncCounts): boolean {
  return created > 0 || updated > 0 || archived > 0
}
