import { getServerSideSitemapIndex } from "next-sitemap"

import { getSiteURL } from "@/utilities/getURL"

import { listedSitemapPaths } from "../listedSitemapPaths"

// Rendered per request, so it follows the news sitemap's cached list (which publishing an
// article refreshes) and SERVER_URL as the server has it, rather than the build's.
export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const siteUrl = getSiteURL()

  return getServerSideSitemapIndex((await listedSitemapPaths()).map((path) => `${siteUrl}${path}`))
}
