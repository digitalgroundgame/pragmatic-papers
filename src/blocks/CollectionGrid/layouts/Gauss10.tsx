import React from "react"

import { cn } from "@/utilities/utils"
import { CollectionTile } from "../CollectionTile"
import type { LayoutDefinition, LayoutProps } from "../types"

export const Gauss10: LayoutDefinition = {
  label: "Gauss 10",
  minSlots: 8,
  maxSlots: 10,
  slotDescriptions: [
    "Featured Center (Image Above)",
    "Left Column, Top",
    "Left Column, Middle (Compact)",
    "Left Column, Bottom (Compact)",
    "Right Column, Top",
    "Right Column, Middle (Compact)",
    "Right Column, Bottom (Compact)",
    "Bottom Left (Image Left/Above, Required)",
    "Bottom Center (Image Above, Optional)",
    "Bottom Right (Image Above, Optional)",
  ],
}

/**
 * Gauss 10 Layout
 *
 * 5-column grid: left column | featured (3 cols) | right column.
 * Bottom row (G, H, I) sits under the featured column; H and I are optional.
 *
 * Slots (by index):
 *   0: Featured — center, spans 3 cols (image above)
 *   1: A — left column, top
 *   2: B — left column, middle (compact)
 *   3: C — left column, bottom (compact)
 *   4: D — right column, top
 *   5: E — right column, middle (compact)
 *   6: F — right column, bottom (compact)
 *   7: G — bottom left (image left/above if H & I are present, required)
 *   8: H — bottom center (image above, optional)
 *   9: I — bottom right (image above, optional)
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
      className={cn("grid grid-cols-1 gap-6 text-ellipsis md:grid-cols-5", className)}
      {...props}
    >
      {/* Slots A, B, C — left column */}
      <div className="flex min-w-0 flex-col gap-6">
        <CollectionTile
          tile={a!}
          loading={loading}
          sizes="(max-width: 768px) 100vw, 300px"
          variant="medium"
        />
        <CollectionTile
          tile={b!}
          loading={loading}
          sizes="(max-width: 768px) 100vw, 300px"
          variant="medium"
        />
        <CollectionTile tile={c!} imagePosition="none" />
      </div>

      <div className="flex flex-col gap-6 md:col-span-3">
        {/* Featured — spans 3 cols, image above */}
        <CollectionTile
          className="flex-3"
          tile={featured!}
          imagePosition="above"
          priority={priority}
          sizes="(max-width: 768px) 100vw, 460px"
          variant="medium"
        />
        {/* Slots G, H, I — bottom row; G always present, H and I optional */}
        <div className="flex flex-1 flex-row gap-6">
          <CollectionTile
            className="min-w-0 flex-1"
            tile={g!}
            sizes="(max-width: 768px) 33vw, 100px"
            variant="medium"
            imagePosition={!h && !i ? "left" : "above"}
          />
          {h && (
            <CollectionTile
              className="min-w-0 flex-1"
              tile={h}
              sizes="(max-width: 768px) 33vw, 100px"
              variant="medium"
              imagePosition="above"
            />
          )}
          {i && (
            <CollectionTile
              className="min-w-0 flex-1"
              tile={i}
              sizes="(max-width: 768px) 33vw, 100px"
              variant="medium"
              imagePosition="above"
            />
          )}
        </div>
      </div>

      {/* Slots D, E, F — right column */}
      <div className="flex min-w-0 flex-col gap-6">
        <CollectionTile
          tile={d!}
          loading={loading}
          sizes="(max-width: 768px) 100vw, 300px"
          variant="medium"
        />
        <CollectionTile
          tile={e!}
          loading={loading}
          sizes="(max-width: 768px) 100vw, 300px"
          variant="medium"
        />
        <CollectionTile tile={f!} imagePosition="none" />
      </div>
    </section>
  )
}
