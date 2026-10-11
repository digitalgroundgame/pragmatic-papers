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
