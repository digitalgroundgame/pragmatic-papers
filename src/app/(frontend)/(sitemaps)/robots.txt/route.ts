import { getSiteURL } from "@/utilities/getURL"

import { SITEMAP_PATHS } from "../sitemaps"

// A route rather than a file next-sitemap writes at build time, so revalidate-all can
// re-render it for the host the image serves. Previews and staging are kept out
// of search indexes by the X-Robots-Tag header in src/proxy.ts, not here: crawlers must
// be able to fetch a page to see it.
export async function GET(): Promise<Response> {
  const siteUrl = getSiteURL()
  const sitemaps = ["/sitemap_index.xml", ...SITEMAP_PATHS].map(
    (path) => `Sitemap: ${siteUrl}${path}`,
  )

  const body = [
    "# *",
    "User-agent: *",
    "Disallow: /admin/*",
    "",
    "# Host",
    `Host: ${siteUrl}`,
    "",
    "# Sitemaps",
    ...sitemaps,
    "",
  ].join("\n")

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

// Rendered once and served as a static file, like the feeds. A build prerenders it with the
// build's SERVER_URL; an image deployed somewhere else (built in Actions, or tested by E2E)
// calls /next/revalidate-all at start, which re-renders it once with the runtime one.
export const dynamic = "force-static"
