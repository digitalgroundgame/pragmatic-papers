import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"

import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { getServerSideURL } from "@/utilities/getURL"

// Rendered per request from the cached list below, which saving an interactive refreshes
// (revalidateInteractive): Next would otherwise prerender it at build time, from the build's
// database, with the experiment as the build saw it.
export const dynamic = "force-dynamic"

const getInteractivesSitemap = unstable_cache(
  async (): Promise<MetadataRoute.Sitemap> => {
    const payload = await getPayloadConfig()
    const siteUrl = getServerSideURL()

    const { docs } = await payload.find({
      collection: "interactives",
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: { _status: { equals: "published" } },
      select: { slug: true, updatedAt: true },
    })

    const dateFallback = new Date().toISOString()
    return docs.flatMap((doc) =>
      doc.slug
        ? [
            {
              url: `${siteUrl}/interactives/${doc.slug}`,
              lastModified: doc.updatedAt || dateFallback,
            },
          ]
        : [],
    )
  },
  ["interactives-sitemap"],
  { tags: ["interactives-sitemap"] },
)

/** /interactives/sitemap.xml: each published interactive page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // An experiment that is off lists nothing: its pages 404 in this environment.
  return (await isExperimentEnabled("interactives")) ? getInteractivesSitemap() : []
}
