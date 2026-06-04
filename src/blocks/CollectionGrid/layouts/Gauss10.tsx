import React from "react"

import { cn } from "@/utilities/utils"
import { CollectionTile } from "../CollectionTile"
import type { LayoutDefinition, LayoutProps } from "../types"

export const Gauss10: LayoutDefinition = {
  label: "Gauss 10",
  minSlotCount: 8,
  slotDescriptions: [
    "Featured Left (Image Right)",
    "Bottom Left",
    "Bottom Center",
    "Bottom Right",
    "Right Column, Top",
    "Right Column, Middle (Compact)",
    "Right Column, Bottom (Compact)",
    "Left Column, Top (Compact)",
    "Left Column, Middle (Compact)",
    "Left Column, Bottom (Compact)",
  ],
}

/**
 * Gauss 10 Layout
 *
 * Extends Fibonacci 7 with an optional left column (slots 8–10).
 * Slots 9 and 10 are optional; slot 8 is always required (minSlotCount: 8).
 *
 * Slots (by index):
 *   0: Featured — top, spans 3 cols (image right)
 *   1: A — bottom row, left
 *   2: B — bottom row, center
 *   3: C — bottom row, right
 *   4: D — right column, top (image above)
 *   5: E — right column, middle (compact)
 *   6: F — right column, bottom (compact)
 *   7: G — left column, top (compact, always present)
 *   8: H — left column, middle (compact, optional)
 *   9: I — left column, bottom (compact, optional)
 *
 * Desktop (lg:grid-cols-5)
 */
export const Gauss10Layout: React.FC<LayoutProps> = ({
  className,
  slots,
  priority,
  loading,
  ...props
}) => {
  const [featured, a, b, c, d, e, f, g, h, i] = slots

  return (
    <section
      className={cn("grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5", className)}
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

      {/* Right column: d (image above), e + f compact — spans 2 rows */}
      <div className="flex flex-col gap-6 lg:row-span-2">
        <CollectionTile
          tile={d!}
          loading={loading}
          sizes="(max-width: 768px) 100vw, 300px"
          variant="medium"
        />
        <CollectionTile tile={e!} imagePosition="none" />
        <CollectionTile tile={f!} imagePosition="none" />
      </div>

      {/* Bottom row: a, b, c */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
        <CollectionTile tile={a!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
        <CollectionTile tile={b!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
        <CollectionTile tile={c!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
      </div>

      {/* Left column — g always present (min 8 slots), h and i optional.
          Last in DOM for mobile stacking order; lg:order-first repositions it visually. */}
      <div className="flex flex-col gap-4 md:col-span-2 lg:order-first lg:row-span-2">
        <CollectionTile tile={g!} imagePosition="none" />
        {h && <CollectionTile tile={h} imagePosition="none" />}
        {i && <CollectionTile tile={i} imagePosition="none" />}
      </div>
    </section>
  )
}
