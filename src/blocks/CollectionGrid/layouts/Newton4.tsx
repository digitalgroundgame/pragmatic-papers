import React from "react"

import { cn } from "@/utilities/utils"
import { CollectionTile } from "../CollectionTile"
import type { LayoutDefinition, LayoutProps } from "../types"

export const Newton4: LayoutDefinition = {
  label: "Newton 4",
  slotDescriptions: [
    "Featured Left",
    "Right Column, Top",
    "Right Column, Middle",
    "Right Column, Bottom",
  ],
}

/**
 * Newton 4 Layout
 * Desktop: 75%/25% two-column split
 */
export const Newton4Layout: React.FC<LayoutProps> = ({
  className,
  slots,
  priority,
  loading,
  ...props
}) => {
  const [featured, a, b, c] = slots

  return (
    <section className={cn("grid grid-cols-1 gap-6 md:grid-cols-[3fr_1fr]", className)} {...props}>
      {/* Featured — left column (75%) */}
      <CollectionTile
        className="h-full"
        tile={featured!}
        priority={priority}
        sizes="(max-width: 768px) 100vw, 920px"
        variant="large"
      />

      {/* Right column — 3 stacked tiles (25%) */}
      <div className="grid grid-cols-1 gap-6">
        <CollectionTile
          tile={a!}
          loading={loading}
          sizes="(max-width: 768px) 100vw, 310px"
          variant="medium"
        />
        <CollectionTile tile={b!} imagePosition="none" />
        <CollectionTile tile={c!} imagePosition="none" />
      </div>
    </section>
  )
}
