// The sitemaps the index and robots.txt point crawlers at, one route each. The `*-sitemap.xml`
// routes in this folder are the ones production served first; newer ones are a `sitemap.ts`
// in their own route's folder.
export const SITEMAP_PATHS = [
  "/pages-sitemap.xml",
  "/articles-sitemap.xml",
  "/volumes-sitemap.xml",
  "/interactives/sitemap.xml",
  "/docs/sitemap.xml",
  "/authors/sitemap.xml",
  "/topics/sitemap.xml",
] as const
