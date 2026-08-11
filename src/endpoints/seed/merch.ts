import type { Payload, RequestContext } from "payload"

/**
 * Seeded merch products.
 *
 * In production these rows are written by the `syncShopifyProducts` job, but
 * dev and CI have no store credentials — the job skips its run there, so the
 * seed has to stand in or every Merch block renders empty.
 *
 * Images point at a seeded Media file rather than `cdn.shopify.com`: the whole
 * point of a local seed is that it works without the network.
 */
export interface SeedMerchProduct {
  title: string
  handle: string
  price: string
  /** Media doc to borrow the image URL and dimensions from. */
  imageId: number
  availableForSale?: boolean
  featured?: boolean
  sortOrder?: number
}

/**
 * The dev catalogue, defined once. Several placements seed from it — sharing
 * one list is what keeps them from fighting over the unique `handle`.
 */
export function devMerchCatalogue(mediaIds: number[]): SeedMerchProduct[] {
  const image = (index: number): number => mediaIds[index % mediaIds.length] ?? mediaIds[0]!

  return [
    {
      title: "Liberia Logo Tee",
      handle: "logo-tee",
      price: "28.00",
      imageId: image(0),
      featured: true,
    },
    { title: "Pragmatic Papers Mug", handle: "pragmatic-mug", price: "16.00", imageId: image(1) },
    { title: "Canvas Tote Bag", handle: "canvas-tote", price: "22.00", imageId: image(2) },
    {
      title: "Enamel Pin Set",
      handle: "enamel-pins",
      price: "12.00",
      imageId: image(3),
      availableForSale: false,
    },
    { title: "Field Notes Set", handle: "field-notes", price: "14.00", imageId: image(4) },
    { title: "Sticker Pack", handle: "stickers", price: "8.00", imageId: image(5) },
  ]
}

/**
 * Upsert seed products by handle and return their ids.
 *
 * Upsert rather than create because seeds re-run, and because more than one
 * placement seeds from the same catalogue — the second caller has to find the
 * rows the first one made, not collide with them.
 */
export async function seedMerchProducts(
  payload: Payload,
  products: SeedMerchProduct[],
  context?: RequestContext,
): Promise<number[]> {
  const ids: number[] = []

  for (const [index, product] of products.entries()) {
    const media = await payload.findByID({ collection: "media", id: product.imageId })

    // The square resize is what the block used to render, so borrowing it keeps
    // seeded placements pixel-identical to the pre-sync baselines.
    const square = media.sizes?.square
    const url = square?.url || media.url
    const width = square?.width || media.width
    const height = square?.height || media.height

    const data = {
      // Stable fake Shopify IDs, so a re-seed updates rather than duplicates.
      externalId: `gid://shopify/Product/seed-${product.handle}`,
      source: "shopify" as const,
      title: product.title,
      handle: product.handle,
      price: product.price,
      currencyCode: "USD",
      availableForSale: product.availableForSale ?? true,
      imageUrl: url,
      imageWidth: width,
      imageHeight: height,
      imageAlt: media.alt || product.title,
      tags: [],
      collections: [],
      status: "active" as const,
      featured: product.featured ?? false,
      sortOrder: product.sortOrder ?? index,
      lastSyncedAt: new Date().toISOString(),
    }

    const existing = await payload.find({
      collection: "merch",
      where: { handle: { equals: product.handle } },
      limit: 1,
    })

    const current = existing.docs[0]
    const doc = current
      ? await payload.update({ collection: "merch", id: current.id, context, data })
      : await payload.create({ collection: "merch", context, data })

    ids.push(doc.id)
  }

  return ids
}
