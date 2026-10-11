import { unstable_cache } from "next/cache"

import { getPayloadClient } from "@/data/payload"
import { getSiteURL } from "@/utilities/getURL"

// Google News reads only articles from the last two days, and asks that older ones leave the
// news sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

export const getNewsSitemap = unstable_cache(
  async () => {
    const payload = await getPayloadClient()
    const siteUrl = getSiteURL()

    const { docs } = await payload.find({
      collection: "articles",
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      sort: "-publishedAt",
      where: {
        _status: { equals: "published" },
        publishedAt: { greater_than_equal: new Date(Date.now() - NEWS_WINDOW_MS).toISOString() },
      },
      select: { slug: true, title: true, publishedAt: true, updatedAt: true },
    })

    return docs.flatMap((article) =>
      article.slug && article.publishedAt
        ? [
            {
              loc: `${siteUrl}/articles/${article.slug}`,
              lastmod: article.updatedAt,
              news: {
                title: article.title,
                publicationName: "The Pragmatic Papers",
                publicationLanguage: "en",
                date: article.publishedAt,
              },
            },
          ]
        : [],
    )
  },
  ["articles-news-sitemap"],
  // Publishing an article refreshes it at once; the hour lets articles age out of the window.
  { tags: ["articles-sitemap"], revalidate: 3600 },
)
