import config from "@payload-config"
import { getServerSideSitemap } from "next-sitemap"
import { unstable_cache } from "next/cache"
import { getPayload } from "payload"

const getArticlesSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL

    const results = await payload.find({
      collection: "articles",
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        _status: {
          equals: "published",
        },
      },
      select: {
        slug: true,
        updatedAt: true,
        title: true,
        publishedAt: true,
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = results.docs
      ? results.docs
          .filter((page) => Boolean(page?.slug))
          .map((page) => {
            return {
              loc: page?.slug === "home" ? SITE_URL : `${SITE_URL}/articles/${page?.slug}`,
              lastmod: page.updatedAt || dateFallback,
              news: {
                title: page.title,
                publicationName: "The Pragmatic Papers",
                publicationLanguage: "en",
                date: page.publishedAt ?? dateFallback,
              },
            }
          })
      : []

    return sitemap
  },
  ["articles-sitemap"],
  {
    tags: ["articles-sitemap"],
  },
)

export async function GET(): Promise<Response> {
  const sitemap = await getArticlesSitemap()

  return getServerSideSitemap(sitemap)
}
