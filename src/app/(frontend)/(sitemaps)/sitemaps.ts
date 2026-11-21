import { SITEMAPS } from "@/data/feeds"

export const SITEMAP_PATHS = SITEMAPS.map((sitemap) => sitemap.path)

// The sitemap protocol's cap on URLs in one sitemap (https://www.sitemaps.org/protocol.html).
// Each sitemap asks Payload for at most this many documents, freshest first, so a collection
// that outgrows it drops its oldest entries rather than an arbitrary few. Payload applies
// `limit` even with `pagination: false`.
export const MAX_SITEMAP_ENTRIES = 50_000
