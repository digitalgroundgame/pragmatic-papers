import React from "react"

import { cn } from "@/utilities/utils"
import { CollectionTile } from "../CollectionTile"
import type { LayoutDefinition, LayoutProps } from "../types"

export const Fibonacci6: LayoutDefinition = {
  label: "Fibonacci 6",
  slotDescriptions: [
    "Featured Left (Image Right)",
    "Bottom Left",
    "Bottom Center",
    "Bottom Right",
    "Right Column, Top",
    "Right Column, Bottom",
  ],
}

/**
 * Fibonacci 6 Layout
 *
 * Like Fibonacci 7, but the right column has two image-above tiles
 * instead of one image-above + two no-image tiles.
 *
 * Slots (by index):
 *   0: Featured — top-left spanning 3 cols (image right)
 *   1: A — bottom row, left
 *   2: B — bottom row, center
 *   3: C — bottom row, right
 *   4: D — right column, top
 *   5: E — right column, bottom
 *
 * Desktop (lg:grid-cols-4)
 */
export const Fibonacci6Layout: React.FC<LayoutProps> = ({
  className,
  slots,
  priority,
  loading,
  ...props
}) => {
  const [featured, a, b, c, d, e] = slots
  return (
    <section
      className={cn("grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4", className)}
      {...props}
    >
      {/* Featured — spans 3 cols, image to the right */}
      <CollectionTile
        className="md:col-span-2 lg:col-span-3"
        tile={featured!}
        imagePosition="right"
        priority={priority}
        sizes="(max-width: 768px) 100vw, 460px"
        variant="medium"
      />

      {/* Slots D + E — right column: both image above */}
      <div className="flex flex-col gap-6 lg:row-span-2">
        <CollectionTile
          tile={d!}
          loading={loading}
          sizes="(max-width: 768px) 100vw, 300px"
          variant="medium"
        />
        <CollectionTile tile={e!} imagePosition="none" />
      </div>

      {/* Slots A, B, C — image above, 3 cols under featured */}
      <div className="lg:col-span-3">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <CollectionTile tile={a!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
          <CollectionTile tile={b!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
          <CollectionTile tile={c!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
        </div>
      </div>
    </section>
  )
}
