// The sitemaps /sitemap_index.xml, robots.txt and /feeds point crawlers and readers at: each a
// `sitemap.ts` in the folder of the section it lists (pages, which live at the root, in the root
// one), except Google News, whose tags `sitemap.ts` can't write, which is a route handler.
// /interactives/sitemap.xml exists but isn't listed while interactives are a beta whose name
// may still change: add it here when the experiment graduates.
export const SITEMAPS = [
  { path: "/sitemap.xml", title: "Pages" },
  { path: "/articles/sitemap.xml", title: "Articles" },
  { path: "/articles/news-sitemap.xml", title: "Google News: articles from the last two days" },
  { path: "/volumes/sitemap.xml", title: "Volumes" },
  { path: "/contributors/sitemap.xml", title: "Contributors" },
  { path: "/topics/sitemap.xml", title: "Topics" },
] as const

export const SITEMAP_PATHS = SITEMAPS.map((sitemap) => sitemap.path)
