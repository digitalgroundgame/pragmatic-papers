// The sitemaps the index and robots.txt point crawlers at: each a `sitemap.ts` in the folder of
// the section it lists, except pages (at the root, beside this index) and Google News, whose
// tags `sitemap.ts` can't write, which are route handlers.
export const SITEMAP_PATHS = [
  "/pages-sitemap.xml",
  "/articles/sitemap.xml",
  "/articles/news-sitemap.xml",
  "/volumes/sitemap.xml",
  "/interactives/sitemap.xml",
  "/authors/sitemap.xml",
  "/topics/sitemap.xml",
  "/docs/sitemap.xml",
] as const
