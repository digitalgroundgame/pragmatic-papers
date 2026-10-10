import type { MetadataRoute } from "next"

import { getServerSideURL } from "@/utilities/getURL"

import { SITEMAP_PATHS } from "./(frontend)/(sitemaps)/sitemaps"

// Static, like the feeds: a build prerenders it with the build's SERVER_URL, and an image
// deployed somewhere else (built in Actions, or tested by E2E) calls /next/revalidate-all at
// start, which re-renders it once with the runtime one. Previews and staging are kept out of
// search indexes by the X-Robots-Tag header in src/proxy.ts, not here: crawlers must be able
// to fetch a page to see it.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getServerSideURL()

  return {
    rules: { userAgent: "*", disallow: "/admin/*" },
    host: siteUrl,
    sitemap: ["/sitemap_index.xml", ...SITEMAP_PATHS].map((path) => `${siteUrl}${path}`),
  }
}
