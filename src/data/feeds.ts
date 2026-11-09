// The site's RSS feeds and sitemaps, kept apart from the routes that serve them because the
// page <head>, robots.txt and /sitemap_index.xml read them.

/**
 * The RSS feeds for feed readers, advertised in every page's `<head>`. The Substack feed
 * (/articles/substack.xml) isn't one: it's only for Substack's importer.
 */
export const FEEDS = [
  { path: "/articles/feed.xml", title: "Pragmatic Papers - Articles RSS Feed" },
  { path: "/volumes/feed.xml", title: "Pragmatic Papers - Volumes RSS Feed" },
] as const

// The sitemaps /sitemap_index.xml and robots.txt point crawlers at: each a `sitemap.ts` in the
// folder of the section it lists (pages, which live at the root, in the root one), except
// Google News, whose tags `sitemap.ts` can't write, which is a route handler.
// /interactives/sitemap.xml exists but isn't listed while interactives are a beta whose name
// may still change: add it here when the experiment graduates.
export const SITEMAPS = [
  { path: "/sitemap.xml" },
  { path: "/articles/sitemap.xml" },
  { path: "/articles/news-sitemap.xml" },
  { path: "/volumes/sitemap.xml" },
  { path: "/contributors/sitemap.xml" },
  { path: "/topics/sitemap.xml" },
  { path: "/docs/sitemap.xml" },
] as const
