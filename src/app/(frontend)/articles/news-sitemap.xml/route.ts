import { getServerSideSitemap } from "next-sitemap"
import { unstable_cache } from "next/cache"

import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { getServerSideURL } from "@/utilities/getURL"

// Google News reads only articles from the last two days, and asks that older ones leave the
// news sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

const getNewsSitemap = unstable_cache(
  async () => {
    const payload = await getPayloadConfig()
    const siteUrl = getServerSideURL().replace(/\/$/, "")

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

/**
 * /articles/news-sitemap.xml: the Google News sitemap, articles published in the last two days.
 * A route handler rather than a `sitemap.ts`, which can't write the `news:` tags. Every article
 * is in /articles/sitemap.xml.
 */
export async function GET(): Promise<Response> {
  return getServerSideSitemap(await getNewsSitemap())
}
