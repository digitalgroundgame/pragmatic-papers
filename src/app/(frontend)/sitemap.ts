import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"

import { getPayloadClient } from "@/data/payload"
import { getSiteURL } from "@/utilities/getURL"

// Rendered per request from the cached list below, which saving a page refreshes
// (revalidatePage): Next would otherwise prerender it at build time, from the build's database.
export const dynamic = "force-dynamic"

const getPagesSitemap = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const payload = await getPayloadClient()
    const siteUrl = getSiteURL()

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
 * /sitemap.xml: the home page and every other published page, which all live at the root. Each
 * section lists its own in a nested `sitemap.ts`; /sitemap_index.xml points at them all.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getPagesSitemap()
}
