import { getServerSideSitemapIndex } from "next-sitemap"

import { getServerSideURL } from "@/utilities/getURL"

import { SITEMAP_PATHS } from "../sitemaps"

// Built per request rather than written at build time, so the same image lists the
// host it serves (#1090).
export async function GET(): Promise<Response> {
  const siteUrl = getServerSideURL()

  return getServerSideSitemapIndex(SITEMAP_PATHS.map((path) => `${siteUrl}${path}`))
}

// Never prerendered: a build would bake its own host in.
export const dynamic = "force-dynamic"
