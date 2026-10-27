import type { RequiredDataFromCollectionSlug } from "payload"

import { createHeadingNode, createParagraph, createRichText } from "@/utilities/lexical"

const TITLE = "Feeds and sitemaps"
const DESCRIPTION = "Follow Pragmatic Papers in a feed reader, or find every page we publish."

/** /feeds, which the footer links to: the feed and sitemap lists, each a Feed list block. */
export const feedsPage: RequiredDataFromCollectionSlug<"pages"> = {
  title: TITLE,
  slug: "feeds",
  hero: {
    type: "pageHero",
    richText: createRichText([createHeadingNode(TITLE, "h1"), createParagraph(DESCRIPTION)]),
    links: [],
    media: null,
  },
  layout: [
    {
      blockType: "feedsList",
      list: "feeds",
      title: "RSS feeds",
      description:
        "Paste a feed's address into your feed reader to get new pieces as they're published.",
    },
    {
      blockType: "feedsList",
      list: "sitemaps",
      title: "Sitemaps",
      description: "For search engines: the sitemap index lists all the others.",
    },
  ],
  meta: { title: `${TITLE} — Pragmatic Papers`, description: DESCRIPTION, image: null },
}
