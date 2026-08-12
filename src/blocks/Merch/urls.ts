/**
 * Where merch links point.
 *
 * The storefront API is only the data source — readers are sent to the site
 * that owns the product pages and the cart, which is a different property and
 * is named entirely by `MERCH_SITE_URL`. Nothing about that site is baked in
 * here: no host, no path, no fallback. An unset variable means we don't know
 * where a product lives, and the block renders nothing rather than guessing.
 *
 * `MERCH_SITE_URL` is the store page itself, path included, so moving the
 * storefront — a different path, a staging host, a different site entirely —
 * is a config change rather than a code change.
 *
 * Product URLs are derived from the synced handle rather than stored, which is
 * what keeps them alive: a product renamed upstream would 404 until the next
 * sync refreshes its handle.
 */

/** The store page — the "Shop all" destination, or null when unconfigured. */
export function getMerchStoreUrl(): string | null {
  const configured = process.env.MERCH_SITE_URL?.trim()
  if (!configured) return null

  try {
    // A trailing slash would double up when a product handle is appended.
    return new URL(configured).href.replace(/\/$/, "")
  } catch {
    return null
  }
}

/** A single product's page on the store site, or null when unconfigured. */
export function getMerchProductUrl(handle: string): string | null {
  const store = getMerchStoreUrl()
  if (!store) return null

  return new URL(`${store}/${encodeURIComponent(handle)}`).href
}
