import { getServerSideURL } from "@/utilities/getURL"

import { SITEMAP_PATHS } from "../sitemaps"

// Built per request rather than written at build time, so the same image names the
// host it serves (#1090). Previews and staging are kept out of search indexes by the
// X-Robots-Tag header in src/proxy.ts, not here: crawlers must be able to fetch a page
// to see it.
export async function GET(): Promise<Response> {
  const siteUrl = getServerSideURL()
  const sitemaps = ["/sitemap.xml", ...SITEMAP_PATHS].map((path) => `Sitemap: ${siteUrl}${path}`)

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

// Never prerendered: a build would bake its own host in.
export const dynamic = "force-dynamic"
