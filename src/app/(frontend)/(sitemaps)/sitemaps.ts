// The sitemaps the index, robots.txt and /feeds point crawlers and readers at: each a
// `sitemap.ts` in the folder of the section it lists, except pages (at the root, beside this
// index) and Google News, whose tags `sitemap.ts` can't write, which are route handlers.
// /interactives/sitemap.xml exists but isn't listed while interactives are a beta whose name
// may still change: add it here when the experiment graduates.
export const SITEMAPS = [
  { path: "/pages-sitemap.xml", title: "Pages" },
  { path: "/articles/sitemap.xml", title: "Articles" },
  { path: "/articles/news-sitemap.xml", title: "Google News: articles from the last two days" },
  { path: "/volumes/sitemap.xml", title: "Volumes" },
  { path: "/authors/sitemap.xml", title: "Authors" },
  { path: "/topics/sitemap.xml", title: "Topics" },
  { path: "/docs/sitemap.xml", title: "Docs" },
] as const

export const SITEMAP_PATHS = SITEMAPS.map((sitemap) => sitemap.path)
