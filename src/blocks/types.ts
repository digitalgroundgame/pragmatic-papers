import type { LucideIcon } from "lucide-react"

import type { FeedBlockBehavior } from "@/blocks/feed/types"
import type { FeedContext } from "@/utilities/feedHTML"

/** Renders a block's fields as plain HTML for a feed. See `converters.ts` in each block. */
export type BlockToHTML<Fields> = (fields: Fields, context: FeedContext) => string

/** What a block's narration can ask of the article it sits in. */
export interface NarrationContext {
  /** The caption, or else the alt text, of a media value (an id or a populated document). */
  describeMedia: (media: unknown) => string
  /** The plain text of nested rich text, as narration reads it. */
  textOf: (richText: unknown) => string
}

/** A block's entry in the article's table of contents, or null to leave it out. */
export interface BlockTableOfContentsEntry {
  label: string
  icon: LucideIcon
}

/** Stored block data, read defensively: it may predate the block's current fields. */
export type StoredBlock = Record<string, unknown>

/** Where a block keeps media, so Media's References tab finds it and Detach removes it. */
export interface BlockMedia {
  /** Every media value (an id or a populated document) the block holds. */
  find: (block: StoredBlock) => unknown[]
  /**
   * The block without the media `uses` matches: the same object when it doesn't use it, a
   * copy without it when it does, or null when the block can't stand without it.
   */
  detach: (block: StoredBlock, uses: (media: unknown) => boolean) => StoredBlock | null
}

/**
 * Everything the site needs to know about one block slug, except how it renders as React
 * (`RichText` and `RenderBlocks` own that, since their components are server-only and would
 * otherwise reach every module that reads this). Each block's `index.ts` exports its
 * descriptors, and `src/blocks/registry.ts` lists them; the feeds, the narration, the table
 * of contents, Media's references and the reading feed all read that list.
 *
 * Browser- and Node-safe: Storybook and the Payload CLI import it, so nothing here may import
 * server-only code, a React component or the Payload config.
 */
export interface BlockDescriptor<Fields = Record<string, unknown>> {
  /** The block's slug, as its `config.ts` names it. */
  slug: string
  /** An inline block (Lexical's `inlineBlocks`), rendered within a paragraph. */
  inline?: boolean
  /** HTML for the RSS feeds. Required for a block the article or volume editor offers. */
  html?: BlockToHTML<Fields>
  /** HTML for the Substack import feed, when it differs from `html`. */
  substack?: BlockToHTML<Fields>
  /**
   * What the article's narration reads aloud in the block's place. Required for a block the
   * article editor offers; return "" to say nothing.
   */
  narrate?: (fields: StoredBlock, context: NarrationContext) => string
  /** How the block takes up the reading feed's pages. Without it, it rides inline with prose. */
  readingFeed?: FeedBlockBehavior
  /** The block's entry in the article's table of contents. Without it, it has none. */
  tableOfContents?: (fields: Fields) => BlockTableOfContentsEntry | null
  /** Required for a block with an upload field, or media it uses can be deleted under it. */
  media?: BlockMedia
}

/** A descriptor whose fields are no longer known: what the registry holds. */
export type AnyBlockDescriptor = BlockDescriptor<never>

/** Declare a block's descriptor with its fields typed, for the registry to hold. */
export function defineBlock<Fields>(descriptor: BlockDescriptor<Fields>): AnyBlockDescriptor {
  return descriptor
}
