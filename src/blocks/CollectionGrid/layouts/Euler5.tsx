import React from "react"

import { cn } from "@/utilities/utils"
import { CollectionTile } from "../CollectionTile"
import type { LayoutDefinition, LayoutProps } from "../types"

export const Euler5: LayoutDefinition = {
  label: "Euler 5",
  slotDescriptions: [
    "First Column",
    "Second Column",
    "Third Column",
    "Fourth Column",
    "Fifth Column",
  ],
}

/**
 * Euler 5 Layout
 *
 * 5 articles in a single row, each with an image above.
 * Responsive: 1 column on mobile, 2 on sm, 3 on md, 5 equal columns on lg+.
 */
export const Euler5Layout: React.FC<LayoutProps> = ({
  className,
  slots,
  priority,
  loading,
  ...props
}) => {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
        className,
      )}
      {...props}
    >
      {slots.map((slot, index) => (
        <CollectionTile
          key={slot?.id ?? index}
          tile={slot}
          priority={index === 0 ? priority : undefined}
          loading={index === 0 ? undefined : loading}
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 250px"
          variant="medium"
        />
      ))}
    </section>
  )
}
