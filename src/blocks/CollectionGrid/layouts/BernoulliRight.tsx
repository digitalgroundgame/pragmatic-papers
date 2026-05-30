import React from "react"

import { CollectionTile } from "../CollectionTile"
import { type LayoutDefinition, type LayoutProps } from "../types"

export const BernoulliRight: LayoutDefinition = {
  label: "Bernoulli Right",
  slotDescriptions: ["Featured Image Right"],
}

/**
 * Bernoulli Right Layout
 *
 * A single article with the image on the left and the title block on the right.
 */
export const BernoulliRightLayout: React.FC<LayoutProps> = ({
  slots,
  priority,
  loading: _loading,
  ...props
}) => {
  const [featured] = slots
  return (
    <section {...props}>
      <CollectionTile
        tile={featured!}
        imagePosition="right"
        priority={priority}
        sizes="(max-width: 768px) 100vw, 620px"
        variant="medium"
      />
    </section>
  )
}
