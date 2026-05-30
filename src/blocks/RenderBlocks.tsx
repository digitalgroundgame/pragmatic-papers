import React from "react"

import type { Page } from "@/payload-types"

import { CallToActionBlock } from "@/blocks/CallToAction/Component"
import { CollectionGridBlock } from "@/blocks/CollectionGrid/Component"
import { ContentBlock } from "@/blocks/Content/Component"
import { ContributorsBlock } from "@/blocks/Contributors/Component"
import { FormBlock } from "@/blocks/Form/Component"
import { MediaBlock } from "@/blocks/MediaBlock/Component"
import { TimelineBlock } from "@/blocks/Timeline/Component"
import { VolumeViewBlock } from "@/blocks/VolumeViewBlock/component"

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
