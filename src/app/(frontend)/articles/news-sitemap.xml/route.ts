import { getServerSideSitemap } from "next-sitemap"

import { getNewsSitemap } from "./getNewsSitemap"

/**
 * /articles/news-sitemap.xml: the Google News sitemap, articles published in the last two days.
 * A route handler rather than a `sitemap.ts`, which can't write the `news:` tags. Every article
 * is in /articles/sitemap.xml.
 */
export async function GET(): Promise<Response> {
  return getServerSideSitemap(await getNewsSitemap())
}
