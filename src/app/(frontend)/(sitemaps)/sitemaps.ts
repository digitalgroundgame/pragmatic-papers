// The sitemaps /sitemap_index.xml, robots.txt and /feeds point crawlers and readers at: each a
// `sitemap.ts` in the folder of the section it lists (pages, which live at the root, in the root
// one), except Google News, whose tags `sitemap.ts` can't write, which is a route handler.
// Two exist but aren't listed, so crawlers aren't pointed at URLs that are about to move:
// /interactives/sitemap.xml while interactives are a beta whose name may still change, and
// /authors/sitemap.xml until the authors pages get a name that fits narrators too. Add each here
// once its URLs are settled.
export const SITEMAPS = [
  { path: "/sitemap.xml", title: "Pages" },
  { path: "/articles/sitemap.xml", title: "Articles" },
  { path: "/articles/news-sitemap.xml", title: "Google News: articles from the last two days" },
  { path: "/volumes/sitemap.xml", title: "Volumes" },
  { path: "/topics/sitemap.xml", title: "Topics" },
  { path: "/docs/sitemap.xml", title: "Docs" },
] as const

export const SITEMAP_PATHS = SITEMAPS.map((sitemap) => sitemap.path)
