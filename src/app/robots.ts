import type { MetadataRoute } from "next"

import { getSiteURL } from "@/utilities/getURL"

import { listedSitemapPaths } from "./(frontend)/(sitemaps)/listedSitemapPaths"

// Rendered per request, like /sitemap_index.xml, so the news sitemap is listed only while it has
// articles, and the host is SERVER_URL as the server has it. Previews and staging are kept out of
// search indexes by the X-Robots-Tag header in src/proxy.ts, not here: crawlers must be able to
// fetch a page to see it.
export const dynamic = "force-dynamic"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = getSiteURL()

  return {
    rules: { userAgent: "*", disallow: "/admin/*" },
    host: siteUrl,
    sitemap: ["/sitemap_index.xml", ...(await listedSitemapPaths())].map(
      (path) => `${siteUrl}${path}`,
    ),
  }
}
