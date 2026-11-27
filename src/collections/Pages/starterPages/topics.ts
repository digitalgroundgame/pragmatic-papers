import type { RequiredDataFromCollectionSlug } from "payload"

import { createHeadingNode, createParagraph, createRichText } from "@/utilities/lexical"

export const TOPICS_TITLE = "Topics"
export const TOPICS_DESCRIPTION = "Browse all topics"

/** The panels /topics showed while it was code. */
export const TOPICS_ASIDE = [
  { blockType: "panel", source: "mostRead" },
  { blockType: "panel", source: "latestVolume" },
  { blockType: "panel", source: "newsletter" },
] as const

/**
 * /topics, a site page: the route lists every topic (the Topics list block) under this page's
 * hero, with this page's aside beside it. Until an editor publishes it, the route shows what
 * it showed as code, the same title, list and panels.
 */
export const topicsPage: RequiredDataFromCollectionSlug<"pages"> = {
  title: TOPICS_TITLE,
  slug: "topics",
  // The route's path: never regenerated from the title.
  generateSlug: false,
  key: "topics",
  hero: {
    type: "pageHero",
    richText: createRichText([
      createHeadingNode(TOPICS_TITLE, "h1"),
      createParagraph(TOPICS_DESCRIPTION),
    ]),
    links: [],
    media: null,
  },
  layout: [{ blockType: "topicsList", emptyMessage: "No topics found." }],
  aside: [...TOPICS_ASIDE],
  meta: {
    title: "Topics | The Pragmatic Papers",
    description: "Browse all topics on Pragmatic Papers.",
    image: null,
  },
}
