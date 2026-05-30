import React from "react"

import { cn } from "@/utilities/utils"
import { CollectionTile } from "../CollectionTile"
import type { LayoutDefinition, LayoutProps } from "../types"

export const Fibonacci7: LayoutDefinition = {
  label: "Fibonacci 7",
  slotDescriptions: [
    "Featured Left (Image Right)",
    "Bottom Left",
    "Bottom Center",
    "Bottom Right",
    "Right Column, Top",
    "Right Column, Middle (Compact)",
    "Right Column, Bottom (Compact)",
  ],
}

/**
 * Desktop (lg:grid-cols-4)
 */
export const Fibonacci7Layout: React.FC<LayoutProps> = ({
  className,
  slots,
  priority,
  loading,
  ...props
}) => {
  const [featured, a, b, c, d, e, f] = slots

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

      {/* Slot D + E + F — right column: D then E, F (no image) */}
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

      {/* Slots A, B, C — image above, 3 cols under featured */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
        <CollectionTile tile={a!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
        <CollectionTile tile={b!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
        <CollectionTile tile={c!} sizes="(max-width: 768px) 100vw, 300px" variant="medium" />
      </div>
    </section>
  )
}
