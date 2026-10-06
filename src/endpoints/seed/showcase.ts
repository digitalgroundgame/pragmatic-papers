import type { Media, User } from "@/payload-types"
import type { Payload } from "payload"

import { createBannerBlocksArticle } from "./features/banners"
import { createCodeBlocksArticle } from "./features/code-blocks"
import { createMoCongressionalMapsArticle } from "./features/interactive-maps"
import { createMathBlocksArticle } from "./features/math-blocks"
import { createMediaCollageArticle } from "./features/media-collage"
import { createRichTextShowcaseArticle } from "./features/rich-text-showcase"
import { createLegacySocialEmbedArticle, createSocialEmbedArticle } from "./features/social-embeds"
import { createTableOfContentsArticle } from "./features/table-of-contents"
import { createTimelineArticle } from "./features/timeline"

/**
 * Feature articles that `pnpm showcase` can push onto a live environment, such
 * as a PR preview or staging. Unlike `seed()`, pushing only adds: an entry
 * whose slug already exists is skipped, and nothing is deleted.
 *
 * This is a catalog, not a queue: each push names the slugs it wants (a PR
 * names them in its description), so entries stay here after their PR merges.
 * Register a feature article by adding its seed with the slug it creates.
 *
 * Not listed: footnotes (links to another seeded article) and the narration
 * demo (needs a narrator account). Topics are left empty, since the target's
 * topic ids aren't known.
 */
export interface ShowcaseEntry {
  slug: string
  create: (
    payload: Payload,
    writers: User[],
    media: Media[],
    context?: Record<string, unknown>,
  ) => Promise<number>
}

export const showcaseEntries: ShowcaseEntry[] = [
  {
    slug: "finding-your-way-table-of-contents",
    create: (payload, writers, media, context) =>
      createTableOfContentsArticle(payload, writers, media, [], context),
  },
  {
    slug: "rich-text-showcase",
    create: (payload, writers, media, context) =>
      createRichTextShowcaseArticle(payload, writers, media, [], context),
  },
  {
    slug: "banners-editorial-notices-in-context",
    create: (payload, writers, media, context) =>
      createBannerBlocksArticle(payload, writers, media, [], context),
  },
  {
    slug: "code-blocks-syntax-samples-for-authors",
    create: (payload, writers, media, context) =>
      createCodeBlocksArticle(payload, writers, media, [], context),
  },
  {
    slug: "equations-in-context-demonstrating-inline-and-display-math",
    create: (payload, writers, media, context) =>
      createMathBlocksArticle(payload, writers, media, [], context),
  },
  {
    slug: "lorem-ipsum-timeline",
    create: (payload, writers, media, context) =>
      createTimelineArticle(payload, writers, media, [], context),
  },
  {
    slug: "grids-carousels-captions-exploring-rich-media-layouts",
    create: (payload, writers, media, context) =>
      createMediaCollageArticle(payload, writers[0]!, media, [], context),
  },
  {
    slug: "social-media-embed-test-all-variations",
    create: (payload, writers, media, context) =>
      createSocialEmbedArticle(payload, writers[0]!, media, [], context),
  },
  {
    slug: "legacy-social-media-embed-test-all-variations",
    create: (payload, writers, media, context) =>
      createLegacySocialEmbedArticle(payload, writers[0]!, media, [], context),
  },
  {
    slug: "missouri-shifting-margins-119-120-congressional-maps",
    create: (payload, writers, media, context) =>
      createMoCongressionalMapsArticle(payload, writers, media, [], context),
  },
]
