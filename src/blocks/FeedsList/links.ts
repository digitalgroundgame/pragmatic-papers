import { FEEDS, SITEMAPS } from "@/data/feeds"
import type { FeedsListBlock } from "@/payload-types"

export interface FeedLink {
  path: string
  title: string
  description?: string
}

/** The links a Feed list block shows: every RSS feed, or the sitemap index and each sitemap. */
export function feedLinks(list: FeedsListBlock["list"]): readonly FeedLink[] {
  return list === "sitemaps"
    ? [{ path: "/sitemap_index.xml", title: "Sitemap index" }, ...SITEMAPS]
    : FEEDS
}
