import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"

import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { getServerSideURL } from "@/utilities/getURL"

// Rendered per request from the cached list below, which saving a page refreshes
// (revalidatePage): Next would otherwise prerender it at build time, from the build's database.
export const dynamic = "force-dynamic"

const getPagesSitemap = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const payload = await getPayloadConfig()
    const siteUrl = getServerSideURL().replace(/\/$/, "")

    const { docs } = await payload.find({
      collection: "pages",
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: { _status: { equals: "published" } },
      select: { slug: true, updatedAt: true },
    })

    const dateFallback = new Date().toISOString()
    return docs.flatMap((page) =>
      page.slug
        ? [
            {
              url: page.slug === "home" ? siteUrl : `${siteUrl}/${page.slug}`,
              lastModified: page.updatedAt || dateFallback,
            },
          ]
        : [],
    )
  },
  ["pages-sitemap"],
  { tags: ["pages-sitemap"] },
)

/**
 * /pages/sitemap.xml: each published page. Pages are served from the site root (`/<slug>`),
 * which has no folder of its own to hold a sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getPagesSitemap()
}
