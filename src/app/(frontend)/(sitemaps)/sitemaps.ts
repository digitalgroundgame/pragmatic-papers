// The sitemaps the index and robots.txt point crawlers at, each a `sitemap.ts` (or, for the
// Google News tags `sitemap.ts` can't write, a route handler) in the folder of the section it
// lists.
export const SITEMAP_PATHS = [
  "/pages/sitemap.xml",
  "/articles/sitemap.xml",
  "/articles/news-sitemap.xml",
  "/volumes/sitemap.xml",
  "/interactives/sitemap.xml",
  "/authors/sitemap.xml",
  "/topics/sitemap.xml",
  "/docs/sitemap.xml",
] as const
