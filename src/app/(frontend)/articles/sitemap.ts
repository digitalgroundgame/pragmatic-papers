import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"

import { MAX_SITEMAP_ENTRIES } from "@/app/(frontend)/(sitemaps)/sitemaps"
import { getPayloadClient } from "@/data/payload"
import { getSiteURL } from "@/utilities/getURL"

// Rendered per request from the cached list below, which saving an article refreshes
// (revalidateArticle): Next would otherwise prerender it at build time, from the build's database.
export const dynamic = "force-dynamic"

const getArticlesSitemap = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const payload = await getPayloadClient()
    const siteUrl = getSiteURL()

    const { docs } = await payload.find({
      collection: "articles",
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: MAX_SITEMAP_ENTRIES,
      pagination: false,
      sort: "-updatedAt",
      where: { _status: { equals: "published" } },
      select: { slug: true, updatedAt: true },
    })

    const dateFallback = new Date().toISOString()
    return docs.flatMap((article) =>
      article.slug
        ? [
            {
              url: `${siteUrl}/articles/${article.slug}`,
              lastModified: article.updatedAt || dateFallback,
            },
          ]
        : [],
    )
  },
  ["articles-sitemap"],
  { tags: ["articles-sitemap"] },
)

/** /articles/sitemap.xml: each published article. Google News reads /articles/news-sitemap.xml. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getArticlesSitemap()
}
