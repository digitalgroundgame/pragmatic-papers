/**
 * Where merch links point.
 *
 * Shopify is only the data source. `store.digitalgroundgame.org` is never a
 * destination for a reader: digitalgroundgame.org has duplicated the products
 * and the cart, and generates its own product pages from the same API, so
 * that's where a click has to land.
 *
 * URLs are derived from the synced handle rather than stored, which is what
 * keeps them alive — a product renamed in Shopify would 404 on the DiGG site
 * until the next sync refreshes its handle.
 */

const DEFAULT_MERCH_SITE_URL = "https://digitalgroundgame.org"

/** Trailing slashes would double up when we append `/merch`. */
function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "")
}

export function getMerchSiteUrl(): string {
  const configured = process.env.MERCH_SITE_URL?.trim()
  return normalizeBase(configured || DEFAULT_MERCH_SITE_URL)
}

/** The store index — the "Shop all" destination. */
export function getMerchStoreUrl(): string {
  return `${getMerchSiteUrl()}/merch`
}

/** A single product's page on digitalgroundgame.org. */
export function getMerchProductUrl(handle: string): string {
  return `${getMerchStoreUrl()}/${encodeURIComponent(handle)}`
}
