import { bannerBlock } from "@/blocks/Banner"
import { ctaBlock } from "@/blocks/CallToAction"
import { codeBlock } from "@/blocks/Code"
import { collectionGridBlock } from "@/blocks/CollectionGrid"
import { contentBlock } from "@/blocks/Content"
import { contributorsBlock } from "@/blocks/Contributors"
import { feedsListBlock } from "@/blocks/FeedsList"
import { footnoteBlock } from "@/blocks/Footnote"
import { formBlock } from "@/blocks/Form"
import { interactiveMapBlock } from "@/blocks/InteractiveMap"
import { displayMathBlock, inlineMathBlock } from "@/blocks/Math"
import { mediaBlock } from "@/blocks/MediaBlock"
import { mediaCollageBlock } from "@/blocks/MediaCollageBlock"
import { merchBlock } from "@/blocks/Merch"
import { newsletterSignupBlock } from "@/blocks/NewsletterSignup"
import { legacyEmbedBlocks, socialEmbedBlock } from "@/blocks/SocialEmbed"
import { squiggleRuleBlock } from "@/blocks/SquiggleRule"
import { timelineBlock } from "@/blocks/Timeline"
import { volumeViewBlock } from "@/blocks/VolumeViewBlock"
import { fromBlock, type FeedContext } from "@/utilities/feedHTML"

import type { AnyBlockDescriptor, BlockDescriptor } from "./types"

/**
 * Every block's descriptor (`src/blocks/<Name>/index.ts`). The RSS and Substack feeds, the
 * narration, the table of contents, Media's references and the reading feed build their maps
 * from this list, so a block added here reaches all of them; `__tests__/registry.test.ts`
 * fails until every block an editor offers is here with each output that editor needs.
 */
export const BLOCKS: readonly AnyBlockDescriptor[] = [
  bannerBlock,
  codeBlock,
  collectionGridBlock,
  contentBlock,
  contributorsBlock,
  ctaBlock,
  displayMathBlock,
  feedsListBlock,
  footnoteBlock,
  formBlock,
  inlineMathBlock,
  interactiveMapBlock,
  mediaBlock,
  mediaCollageBlock,
  merchBlock,
  newsletterSignupBlock,
  socialEmbedBlock,
  ...legacyEmbedBlocks,
  squiggleRuleBlock,
  timelineBlock,
  volumeViewBlock,
]

const BY_SLUG = new Map(BLOCKS.map((block) => [block.slug, block]))

/** The descriptor for a block slug, if there is one. */
export function blockDescriptor(slug: string | undefined): AnyBlockDescriptor | undefined {
  return slug === undefined ? undefined : BY_SLUG.get(slug)
}

/** One output from every block that declares it, keyed by slug: `blocksWith("readingFeed")`. */
export function blocksWith<K extends keyof BlockDescriptor>(
  output: K,
): Record<string, NonNullable<AnyBlockDescriptor[K]>> {
  const map: Record<string, NonNullable<AnyBlockDescriptor[K]>> = {}
  for (const block of BLOCKS) {
    const value = block[output]
    if (value !== undefined) map[block.slug] = value as NonNullable<AnyBlockDescriptor[K]>
  }
  return map
}

type FeedNodeConverter = ReturnType<typeof fromBlock>

/** The feed formats a block renders to: the RSS feeds' HTML, or the Substack import's. */
export type FeedFormat = "html" | "substack"

/**
 * The block and inline block converters a feed's Lexical HTML conversion takes, each block
 * through its own converter (`src/blocks/<Name>/converters.ts`) in the format the feed wants.
 */
export function feedBlockConverters(
  format: FeedFormat,
  context: Omit<FeedContext, "richTextToHTML">,
): { blocks: Record<string, FeedNodeConverter>; inlineBlocks: Record<string, FeedNodeConverter> } {
  const blocks: Record<string, FeedNodeConverter> = {}
  const inlineBlocks: Record<string, FeedNodeConverter> = {}
  for (const block of BLOCKS) {
    const toHTML = (format === "substack" && block.substack) || block.html
    if (!toHTML) continue
    const map = block.inline ? inlineBlocks : blocks
    map[block.slug] = fromBlock(toHTML, context)
  }
  return { blocks, inlineBlocks }
}
