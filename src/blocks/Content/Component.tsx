import RichText from "@/components/RichText"
import { cn } from "@/utilities/utils"
import { cva } from "class-variance-authority"
import React from "react"

import type { ContentBlock as ContentBlockProps } from "@/payload-types"

const colVariants = cva("col-span-4", {
  variants: {
    size: {
      full: "lg:col-span-12",
      half: "lg:col-span-6 md:col-span-2",
      oneThird: "lg:col-span-4 md:col-span-2",
      twoThirds: "lg:col-span-8 md:col-span-2",
    },
  },
})

const containerVariants = cva("container my-4 grid grid-cols-4 gap-x-6 gap-y-2 lg:grid-cols-12", {
  variants: {
    width: {
      narrow: "max-w-3xl",
      wide: "max-w-5xl",
      full: "px-0",
    },
  },
  defaultVariants: {
    width: "narrow",
  },
})

export const ContentBlock: React.FC<ContentBlockProps> = ({ id: blockId, columns, width }) => {
  if (!columns || !columns.length) return null
  return (
    <section className={containerVariants({ width })}>
      {columns.map(
        ({ id: colId, richText, size }, i) =>
          richText && (
            <RichText
              key={colId ?? `${blockId}-col-${i + 1}`}
              className={cn(colVariants({ size }))}
              data={richText}
              enableGutter={false}
            />
          ),
      )}
    </section>
  )
}
