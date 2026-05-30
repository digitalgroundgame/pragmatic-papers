import RichText from "@/components/RichText"
import { cn } from "@/utilities/utils"
import React from "react"

import type { ContentBlock as ContentBlockProps } from "@/payload-types"

import { CMSLink } from "@/components/Link"

export const ContentBlock: React.FC<ContentBlockProps> = (props) => {
  const { columns } = props

  const colsSpanClasses = {
    full: "lg:col-span-12",
    half: "lg:col-span-6",
    oneThird: "lg:col-span-4",
    twoThirds: "lg:col-span-8",
  }

  return (
    <div className="mx-auto my-4 max-w-3xl px-4">
      <div className="grid grid-cols-4 gap-x-16 gap-y-8 lg:grid-cols-12">
        {columns &&
          columns.length > 0 &&
          columns.map((col, index) => {
            const { enableLink, link, richText, size } = col
            return (
              <div
                className={cn("col-span-4", colsSpanClasses[size!], {
                  "md:col-span-2": size !== "full",
                })}
                key={index}
              >
                {richText && <RichText data={richText} enableGutter={false} />}

                {enableLink && <CMSLink {...link} />}
              </div>
            )
          })}
      </div>
    </div>
  )
}
