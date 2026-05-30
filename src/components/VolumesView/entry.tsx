import type { Volume } from "@/payload-types"
import { cn } from "@/utilities/utils"
import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Separator } from "@/components/ui/separator"
import { formatDateTime } from "@/utilities/formatDateTime"
import { toRoman } from "@/utilities/toRoman"

// import { Media } from '@/components/Media'

export type EntryVolumeData = Pick<
  Volume,
  "slug" | "description" | "title" | "volumeNumber" | "publishedAt"
>

export const Entry: React.FC<{
  alignItems?: "center"
  className?: string
  doc?: EntryVolumeData
  relationTo?: "volumes"
  title?: string
}> = (props) => {
  const { className, doc, relationTo, title: titleFromProps } = props

  const { slug, description, title, volumeNumber, publishedAt } = doc || {}

  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, " ") // replace non-breaking space with white space
  const href = `/${relationTo}/${slug}`

  return (
    <div className={cn("group space-y-3 overflow-hidden", className)}>
      {titleToUse && (
        <h3 className="text-primary hover:text-primary/80">
          <HoverPrefetchLink href={href}>{titleToUse}</HoverPrefetchLink>
        </h3>
      )}
      <div className="text-brand dark:text-brand-high-contrast flex gap-2 text-left font-serif">
        {volumeNumber && <span className="font-semibold">Volume {toRoman(volumeNumber)}</span>}
        <span>•</span>
        {publishedAt && (
          <HoverPrefetchLink
            href={href}
            className="font-semibold underline-offset-2 hover:underline"
          >
            <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
          </HoverPrefetchLink>
        )}
      </div>
      {description && (
        <div className="text-primary max-w-3xl font-serif">
          {description && <p>{sanitizedDescription}</p>}
        </div>
      )}
      <Separator className="mt-6" />
    </div>
  )
}
