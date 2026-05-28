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

export const ContentBlock: React.FC<ContentBlockProps> = ({ columns }) => {
  if (!columns || !columns.length) return null
  return (
    <section className="container grid grid-cols-4 gap-x-6 gap-y-2 lg:grid-cols-12">
      {columns.map(({ id, richText, size }) => (
        <React.Fragment key={id}>
          {richText && (
            <RichText className={cn(colVariants({ size }))} data={richText} enableGutter={false} />
          )}
          {/* {enableLink && <CMSLink {...link} />} */}
        </React.Fragment>
      ))}
    </section>
  )
}
