import type { Where } from "payload"

import { unstable_cache } from "next/cache"

import type { Media, MerchBlock, MerchProduct as MerchProductDoc } from "@/payload-types"

import { MERCH_PRODUCTS_TAG } from "@/collections/MerchProducts/tag"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { getMerchProductUrl } from "./urls"

/**
 * Normalized product shape consumed by the Merch component. This is the
 * contract the data layer produces, so the rendering layer never has to know
 * where a product came from.
 */
export interface MerchProduct {
  id: string
  title: string
  price: string | null
  /** Optional pill overlaid on the image, e.g. "New" or "Sold Out". */
  badge: string | null
  url: string
  /** A Media doc, or a Media-shaped view of a remote Shopify image. */
  image: Media | number | null | undefined
}

/** Default when a block doesn't say how many products to show. */
export const DEFAULT_LIMIT = 12

/**
 * Shopify hands us an amount and a currency code, never a formatted string —
 * the same `Intl.NumberFormat` treatment dgg-frontpage gives it in `money()`.
 */
export function formatPrice(amount?: string | null, currencyCode?: string | null): string | null {
  if (!amount) return null
  const value = Number(amount)
  if (!Number.isFinite(value)) return null

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(value)
}

/**
 * The badge a product earns on its own. An editor's `badgeOverride` always
 * wins; failing that, a sold-out product says so, because that's the one piece
 * of state a reader most needs before clicking through.
 */
export function deriveBadge(product: MerchProductDoc): string | null {
  if (product.badgeOverride?.trim()) return product.badgeOverride
  if (product.availableForSale === false) return "Sold Out"
  return null
}

/**
 * Present a remote Shopify image as a Media doc.
 *
 * `ImageMedia` takes a Payload `Media` and dispatches on its `mimeType`, but
 * synced products have a `cdn.shopify.com` URL rather than an upload. Shaping
 * one here keeps a single rendering path: `getMediaUrl` already passes absolute
 * URLs through untouched, and `cdn.shopify.com` is allow-listed in
 * `next.config.ts`.
 */
export function toMediaShape(product: MerchProductDoc): Media | null {
  if (!product.imageUrl) return null

  return {
    id: -product.id,
    url: product.imageUrl,
    alt: product.imageAlt || product.title,
    width: product.imageWidth ?? undefined,
    height: product.imageHeight ?? undefined,
    // Drives `isImageMedia`, which is what routes this to `ImageMedia`.
    mimeType: "image/jpeg",
    // A remote file has no resize variants, so `variant` is a no-op for merch
    // and the block's per-layout `sizes` hints do the responsive work.
    updatedAt: product.updatedAt,
    createdAt: product.createdAt,
  } as Media
}

/** Map a synced row onto the rendering contract. */
export function toMerchProduct(product: MerchProductDoc): MerchProduct {
  return {
    id: `merch-product-${product.id}`,
    title: product.title,
    price: formatPrice(product.price, product.currencyCode),
    badge: deriveBadge(product),
    url: getMerchProductUrl(product.handle),
    image: toMediaShape(product),
  }
}

/** Translate a block's filter fields into a Payload query. */
export function buildProductQuery(block: MerchBlock): Where {
  // Archived products are gone from Shopify and hidden ones are an editor's
  // call — neither is ever shown, whatever the block asks for.
  const where: Where = {
    and: [{ status: { equals: "active" } }, { hidden: { not_equals: true } }],
  }
  const and = where.and as Where[]

  if (block.source !== "filtered") return where

  if (block.featuredOnly) and.push({ featured: { equals: true } })
  if (block.shopifyCollection?.trim()) {
    and.push({ shopifyCollections: { contains: block.shopifyCollection.trim() } })
  }
  if (block.tag?.trim()) and.push({ tags: { contains: block.tag.trim() } })

  const picked = (block.selectedProducts ?? []).map((product) =>
    typeof product === "number" ? product : product.id,
  )
  if (picked.length) and.push({ id: { in: picked } })

  return where
}

type SortableBlock = Pick<MerchBlock, "orderBy">

/** Payload sort string for a block's `orderBy`. */
export function sortFor({ orderBy }: SortableBlock): string {
  switch (orderBy) {
    case "newest":
      return "-createdAt"
    case "title":
      return "title"
    default:
      return "sortOrder"
  }
}

async function queryMerchProducts(block: MerchBlock): Promise<MerchProductDoc[]> {
  const payload = await getPayloadConfig()

  const { docs } = await payload.find({
    collection: "merch-products",
    where: buildProductQuery(block),
    sort: sortFor(block),
    limit: block.limit ?? DEFAULT_LIMIT,
    depth: 0,
    overrideAccess: false,
  })

  return docs
}

/**
 * Resolve the products to display for a Merch block.
 *
 * Every product on the site flows through here: the block stores a query
 * (all synced products, or a filter over them), never product data, so a price
 * change in Shopify reaches every placement at once.
 *
 * Results are cached under the `merch-products` tag. The sync job drops that
 * tag when a run actually changed something, and the collection's hooks drop it
 * when an editor curates — nothing else invalidates it, so the hourly no-op run
 * costs nothing.
 */
export async function getMerchProducts(block: MerchBlock): Promise<MerchProduct[]> {
  const hasExplicitPicks = block.source === "filtered" && Boolean(block.selectedProducts?.length)

  const load = unstable_cache(
    async () => queryMerchProducts(block),
    [
      "merch-products",
      JSON.stringify(buildProductQuery(block)),
      sortFor(block),
      String(block.limit ?? DEFAULT_LIMIT),
    ],
    { tags: [MERCH_PRODUCTS_TAG] },
  )

  const docs = await load()

  if (!hasExplicitPicks) return docs.map(toMerchProduct)

  // Hand-picked products render in the order the editor arranged them, which
  // no database sort can express.
  const order = new Map(
    (block.selectedProducts ?? [])
      .map((product) => (typeof product === "number" ? product : product.id))
      .map((id, index) => [id, index]),
  )

  return [...docs]
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(toMerchProduct)
}
