import type { Media, MerchBlock } from "@/payload-types"

/**
 * Normalized product shape consumed by the Merch component. This is the
 * contract both data sources produce, so the rendering layer never has to know
 * where a product came from.
 */
export interface MerchProduct {
  id: string
  title: string
  price: string | null
  url: string
  /** Resolved upload (depth ≥ 1) or an unresolved relation id / null. */
  image: Media | number | null | undefined
}

/**
 * Resolve the products to display for a Merch block.
 *
 * Today this normalizes the editor-curated `products` array. It's the single
 * seam for a future live source: when a storefront API integration lands,
 * branch here on a `source` field (e.g. fetch by collection handle) and map the
 * API response into `MerchProduct[]`. Callers stay unchanged.
 */
export function getMerchProducts(products: MerchBlock["products"]): MerchProduct[] {
  if (!products) return []

  return products
    .filter((product) => Boolean(product.title) && Boolean(product.url))
    .map((product, index) => ({
      id: product.id ?? `merch-${index}`,
      title: product.title,
      price: product.price?.trim() ? product.price : null,
      url: product.url,
      image: product.image,
    }))
}
