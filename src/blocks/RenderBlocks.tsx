import React from "react"

import type { Page } from "@/payload-types"

import { CallToActionBlock } from "@/blocks/CallToAction/Component"
import { CollectionGridBlock } from "@/blocks/CollectionGrid/Component"
import { ContentBlock } from "@/blocks/Content/Component"
import { MediaBlock } from "@/blocks/MediaBlock/Component"
import dynamic from "next/dynamic"

// Lazy-loaded blocks: heavy or rarely-used. SSR stays on by default, so the
// HTML/LCP path is unchanged — only the client-side hydration chunk is split.
const ContributorsBlock = dynamic(() =>
  import("@/blocks/Contributors/Component").then((mod) => mod.ContributorsBlock),
)
const FormBlock = dynamic(() => import("@/blocks/Form/Component").then((mod) => mod.FormBlock))
const TimelineBlock = dynamic(() =>
  import("@/blocks/Timeline/Component").then((mod) => mod.TimelineBlock),
)
const VolumeViewBlock = dynamic(() =>
  import("@/blocks/VolumeViewBlock/component").then((mod) => mod.VolumeViewBlock),
)

interface RenderBlocksProps {
  blocks: Page["layout"][number][]
  pageNumber?: number
}

export const RenderBlocks: React.FC<RenderBlocksProps> = ({ blocks, pageNumber }) => {
  return (
    <>
      {blocks.map((block, index) => {
        const { blockType } = block
        const key = `block-${block.id || index}`
        if (blockType === "collectionGrid") {
          return <CollectionGridBlock key={key} {...block} priority={index === 0 || index === 1} />
        } else if (blockType === "content") {
          return <ContentBlock key={key} {...block} />
        } else if (blockType === "contributors") {
          return <ContributorsBlock key={key} {...block} />
        } else if (blockType === "cta") {
          return <CallToActionBlock key={key} {...block} />
        } else if (blockType === "formBlock") {
          if (typeof block.form === "number") return null
          return <FormBlock key={key} {...block} />
        } else if (blockType === "mediaBlock") {
          return <MediaBlock key={key} {...block} />
        } else if (blockType === "timeline") {
          return <TimelineBlock key={key} {...block} />
        } else if (blockType == "volumeView") {
          return <VolumeViewBlock key={key} {...block} pageNumber={pageNumber} />
        }
        return null
      })}
    </>
  )
}
