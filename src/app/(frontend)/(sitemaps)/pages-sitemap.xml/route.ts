import { getServerSideSitemap } from "next-sitemap"
import { unstable_cache } from "next/cache"

import { getPayloadConfig } from "@/utilities/getPayloadConfig"
import { getServerSideURL } from "@/utilities/getURL"

const getPagesSitemap = unstable_cache(
  async () => {
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
              loc: page.slug === "home" ? siteUrl : `${siteUrl}/${page.slug}`,
              lastmod: page.updatedAt || dateFallback,
            },
          ]
        : [],
    )
  },
  ["pages-sitemap"],
  { tags: ["pages-sitemap"] },
)

/**
 * /pages-sitemap.xml: each published page. Pages are served from the site root (`/<slug>`), so
 * their sitemap sits at the root too, beside the /sitemap.xml index, which can't list pages
 * itself. A route handler because a root `sitemap.ts` would be /sitemap.xml.
 */
export async function GET(): Promise<Response> {
  return getServerSideSitemap(await getPagesSitemap())
}
