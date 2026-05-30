import React from "react"

import { cn } from "@/utilities/utils"
import { CollectionTile } from "../CollectionTile"
import type { LayoutDefinition, LayoutProps } from "../types"

export const Euler2: LayoutDefinition = {
  label: "Euler 2",
  slotDescriptions: ["Left Column", "Right Column"],
}

/**
 * Euler 2 Layout
 *
 * 2 articles in a single row, each with an image above.
 * Responsive: 1 column on mobile, 2 equal columns on md+.
 */
export const Euler2Layout: React.FC<LayoutProps> = ({
  className,
  slots,
  priority,
  loading,
  ...props
}) => {
  return (
    <section className={cn("grid grid-cols-1 gap-6 md:grid-cols-2", className)} {...props}>
      {slots.map((slot, index) => (
        <CollectionTile
          key={slot?.id ?? index}
          tile={slot}
          priority={index === 0 ? priority : undefined}
          loading={index === 0 ? undefined : loading}
          sizes="(max-width: 768px) 100vw, 620px"
          variant="medium"
        />
      ))}
    </section>
  )
}
