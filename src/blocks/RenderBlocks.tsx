import React from "react"

import type { Page } from "@/payload-types"

import { CallToActionBlock } from "@/blocks/CallToAction/Component"
import { CollectionGridBlock } from "@/blocks/CollectionGrid/Component"
import { ContentBlock } from "@/blocks/Content/Component"
import { ContributorsBlock } from "@/blocks/Contributors/Component"
import { FeedsListBlock } from "@/blocks/FeedsList/Component"
import { FormBlock } from "@/blocks/Form/Component"
import { MediaBlock } from "@/blocks/MediaBlock/Component"
import { NewsletterSignupBlock } from "@/blocks/NewsletterSignup/Component"
import { MerchBlock } from "@/blocks/Merch/Component"
import { TimelineBlock } from "@/blocks/Timeline/Component"
import { VolumeViewBlock } from "@/blocks/VolumeViewBlock/component"
import { isResolved } from "@/utilities/relationships"
import { getTurnstileSiteKey } from "@/integrations/cloudflare/turnstile"

type LayoutBlock = Page["layout"][number]

interface LayoutContext {
  index: number
  pageNumber?: number
  paginated?: boolean
}

/**
 * How each layout block renders. Keyed by every block type a page's layout can hold, so a
 * block added to the layout fails the type check until it's here. Kept out of the block
 * descriptors (`src/blocks/registry.ts`): these components are server-only, and pages
 * that render rich text but no layout shouldn't load their client code.
 */
const LAYOUT_RENDERERS: {
  [Type in LayoutBlock["blockType"]]: (
    block: Extract<LayoutBlock, { blockType: Type }>,
    context: LayoutContext,
  ) => React.ReactNode
} = {
  collectionGrid: (block, { index }) => (
    <CollectionGridBlock {...block} preload={index === 0 || index === 1} />
  ),
  content: (block) => <ContentBlock {...block} />,
  contributors: (block) => <ContributorsBlock {...block} />,
  cta: (block) => <CallToActionBlock {...block} />,
  feedsList: (block) => <FeedsListBlock {...block} />,
  formBlock: (block) => (isResolved(block.form) ? <FormBlock {...block} /> : null),
  mediaBlock: (block) => <MediaBlock {...block} />,
  merch: (block) => <MerchBlock {...block} />,
  newsletterSignup: (block) => (
    <NewsletterSignupBlock {...block} turnstileSiteKey={getTurnstileSiteKey()} />
  ),
  timeline: (block) => <TimelineBlock {...block} />,
  volumeView: (block, { pageNumber, paginated }) => (
    <VolumeViewBlock {...block} pageNumber={pageNumber} paginated={paginated} />
  ),
}

/** The block types a page's layout can hold. */
export const LAYOUT_BLOCK_TYPES = Object.keys(LAYOUT_RENDERERS)

interface RenderBlocksProps {
  blocks: LayoutBlock[]
  pageNumber?: number
  /** False where `?p=` isn't read, so lists show their first page without page links. */
  paginated?: boolean
}

export const RenderBlocks: React.FC<RenderBlocksProps> = ({ blocks, pageNumber, paginated }) => {
  return (
    <>
      {blocks.map((block, index) => {
        const render = LAYOUT_RENDERERS[block.blockType] as
          ((block: LayoutBlock, context: LayoutContext) => React.ReactNode) | undefined
        if (!render) return null
        return (
          <React.Fragment key={`block-${block.id || index}`}>
            {render(block, { index, pageNumber, paginated })}
          </React.Fragment>
        )
      })}
    </>
  )
}
