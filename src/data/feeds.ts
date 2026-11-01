// The site's RSS feeds and sitemaps. Kept outside the routes that serve them because the page
// <head>, robots.txt, /sitemap_index.xml and the Feed list block all read them, and blocks
// don't import routes.

/**
 * The RSS feeds, all listed on /feeds. Those with a `headTitle` are for feed readers and are also
 * advertised in every page's `<head>`.
 */
export const FEEDS = [
  {
    path: "/articles/feed.xml",
    title: "Articles",
    description: "Every article, newest first.",
    headTitle: "Pragmatic Papers - Articles RSS Feed",
  },
  {
    path: "/volumes/feed.xml",
    title: "Volumes",
    description: "Each volume as it's published.",
    headTitle: "Pragmatic Papers - Volumes RSS Feed",
  },
  {
    path: "/articles/substack.xml",
    title: "Substack syndication",
    description:
      "The articles we republish on our Substack, in markup Substack's importer accepts. It's how they get there; to read along, use the Articles feed.",
  },
] as const

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
  { path: "/docs/sitemap.xml", title: "Docs" },
] as const
