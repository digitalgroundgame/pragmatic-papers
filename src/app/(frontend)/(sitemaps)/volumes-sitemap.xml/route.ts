import { getServerSideSitemap } from "next-sitemap"
import { getPayload } from "payload"
import config from "@payload-config"
import { unstable_cache } from "next/cache"

const getVolumesSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL

    const results = await payload.find({
      collection: "volumes",
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
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = results.docs
      ? results.docs
          .filter((page) => Boolean(page?.slug))
          .map((page) => {
            return {
              loc: page?.slug === "home" ? SITE_URL : `${SITE_URL}/volumes/${page?.slug}`,
              lastmod: page.updatedAt || dateFallback,
            }
          })
      : []

    return sitemap
  },
  ["volumes-sitemap"],
  {
    tags: ["volumes-sitemap"],
  },
)

export async function GET(): Promise<Response> {
  const sitemap = await getVolumesSitemap()

  return getServerSideSitemap(sitemap)
}
