import { getServerSideSitemapIndex } from "next-sitemap"

import { getSiteURL } from "@/utilities/getURL"

import { SITEMAP_PATHS } from "../sitemaps"

// A route rather than a file next-sitemap writes at build time, so revalidate-all can
// re-render it for the host the image serves.
export async function GET(): Promise<Response> {
  const siteUrl = getSiteURL()

  return getServerSideSitemapIndex(SITEMAP_PATHS.map((path) => `${siteUrl}${path}`))
}

// Rendered once and served as a static file, like the feeds. A build prerenders it with the
// build's SERVER_URL; an image deployed somewhere else (built in Actions, or tested by E2E)
// calls /next/revalidate-all at start, which re-renders it once with the runtime one.
export const dynamic = "force-static"
