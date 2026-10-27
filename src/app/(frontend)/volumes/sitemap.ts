import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"

import { MAX_SITEMAP_ENTRIES } from "@/app/(frontend)/(sitemaps)/sitemaps"
import { getPayloadClient } from "@/data/payload"
import { getSiteURL } from "@/utilities/getURL"

// Rendered per request from the cached list below, which saving a volume refreshes
// (revalidateVolumes): Next would otherwise prerender it at build time, from the build's database.
export const dynamic = "force-dynamic"

const getVolumesSitemap = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const payload = await getPayloadClient()
    const siteUrl = getSiteURL()

    const { docs } = await payload.find({
      collection: "volumes",
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
    return docs.flatMap((volume) =>
      volume.slug
        ? [
            {
              url: `${siteUrl}/volumes/${volume.slug}`,
              lastModified: volume.updatedAt || dateFallback,
            },
          ]
        : [],
    )
  },
  ["volumes-sitemap"],
  { tags: ["volumes-sitemap"] },
)

/** /volumes/sitemap.xml: each published volume. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getVolumesSitemap()
}
