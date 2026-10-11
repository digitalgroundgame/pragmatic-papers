import { getNewsSitemap } from "../articles/news-sitemap.xml/getNewsSitemap"

import { SITEMAP_PATHS } from "./sitemaps"

const NEWS_SITEMAP_PATH = "/articles/news-sitemap.xml"

/**
 * The sitemaps /sitemap_index.xml and robots.txt point crawlers at. The news sitemap is left out
 * while no article is inside its two-day window: a sitemap with no `<url>` is invalid, and Search
 * Console reports it as an error. Publishing an article lists it again.
 */
export async function listedSitemapPaths(): Promise<string[]> {
  const hasNews = (await getNewsSitemap()).length > 0
  return SITEMAP_PATHS.filter((path) => hasNews || path !== NEWS_SITEMAP_PATH)
}
