import React from "react"

import { CollectionTile } from "../CollectionTile"
import type { LayoutDefinition, LayoutProps } from "../types"

export const BernoulliLeft: LayoutDefinition = {
  label: "Bernoulli Left",
  slotDescriptions: ["Featured Image Left"],
}

/**
 * Bernoulli Left Layout
 *
 * A single article with the image on the right and the title block on the left.
 */
export const BernoulliLeftLayout: React.FC<LayoutProps> = ({
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
        imagePosition="left"
        priority={priority}
        sizes="(max-width: 768px) 100vw, 620px"
        variant="medium"
      />
    </section>
  )
}
