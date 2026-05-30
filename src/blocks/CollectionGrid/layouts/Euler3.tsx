import React from "react"

import { cn } from "@/utilities/utils"
import { CollectionTile } from "../CollectionTile"
import { type LayoutDefinition, type LayoutProps } from "../types"

export const Euler3: LayoutDefinition = {
  label: "Euler 3",
  slotDescriptions: ["Left Column", "Center Column", "Right Column"],
}

/**
 * Euler 3 Layout
 *
 * 3 articles in a single row, each with an image above.
 * Responsive: 1 column on mobile, 3 equal columns on md+.
 */
export const Euler3Layout: React.FC<LayoutProps> = ({
  className,
  slots,
  priority,
  loading,
  ...props
}) => {
  return (
    <section className={cn("grid grid-cols-1 gap-6 md:grid-cols-3", className)} {...props}>
      {slots.map((slot, index) => (
        <CollectionTile
          key={slot?.id ?? index}
          tile={slot}
          priority={index === 0 ? priority : undefined}
          loading={index === 0 ? undefined : loading}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 33vw, 400px"
          variant="medium"
        />
      ))}
    </section>
  )
}
