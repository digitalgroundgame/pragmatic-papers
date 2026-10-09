/** The RSS feeds readers can follow: listed on /feeds and in every page's `<head>`. */
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
] as const
