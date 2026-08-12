/**
 * Where merch links point.
 *
 * Shopify is only the data source. `store.digitalgroundgame.org` is never a
 * destination for a reader: digitalgroundgame.org has duplicated the products
 * and the cart, and generates its own product pages, so that's where a click
 * has to land.
 *
 * `MERCH_SITE_URL` holds the store page itself, path and all, so moving the
 * storefront (a different path, a staging host) is a config change rather than
 * a code change.
 *
 * Product URLs are derived from the synced handle rather than stored, which is
 * what keeps them alive — a product renamed in Shopify would 404 on the DGG
 * site until the next sync refreshes its handle.
 */

const DEFAULT_MERCH_STORE_URL = "https://digitalgroundgame.org/merch"

/** The store page — the "Shop all" destination. */
export function getMerchStoreUrl(): string {
  const configured = process.env.MERCH_SITE_URL?.trim()

  let url: URL
  try {
    url = new URL(configured || DEFAULT_MERCH_STORE_URL)
  } catch {
    // A malformed override shouldn't take the page down with it — every merch
    // link would throw during render.
    url = new URL(DEFAULT_MERCH_STORE_URL)
  }

  // A trailing slash would double up when a product handle is appended.
  return url.href.replace(/\/$/, "")
}

/** A single product's page on the DGG site. */
export function getMerchProductUrl(handle: string): string {
  return new URL(`${getMerchStoreUrl()}/${encodeURIComponent(handle)}`).href
}
