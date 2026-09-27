/**
 * The Merch block points at the store site (`MERCH_SITE_URL`) rather than at
 * this one, and this site ships no analytics. Tagging the links is the only
 * way to find out whether the block earns its space: the store site's own
 * analytics does the attribution, and the campaign params tell it which
 * placement sent the reader.
 */

const UTM_SOURCE = "pragmaticpapers"
const UTM_MEDIUM = "merch_block"

/** Query strings on anything else (`mailto:`, `tel:`) are meaningless. */
const TAGGABLE_PROTOCOLS = new Set(["http:", "https:"])

/**
 * Append campaign params to a merch link.
 *
 * Editor-supplied params always win — if someone already tagged a URL by hand,
 * that's a deliberate choice. Anything unparseable (a relative path, a typo) is
 * returned untouched rather than dropped.
 */
export function withMerchUtm(url: string, content: string): string {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  if (!TAGGABLE_PROTOCOLS.has(parsed.protocol)) return url

  const params: [string, string][] = [
    ["utm_source", UTM_SOURCE],
    ["utm_medium", UTM_MEDIUM],
    ["utm_content", content],
  ]

  for (const [key, value] of params) {
    if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value)
  }

  return parsed.toString()
}
