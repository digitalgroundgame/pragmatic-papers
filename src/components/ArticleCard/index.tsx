import type { Article } from "@/payload-types"
import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media } from "@/components/Media"
import { cn } from "@/utilities/utils"

export type CardPostData = Pick<Article, "slug" | "meta" | "title">

export const ArticleCard: React.FC<{
  alignItems?: "center"
  className?: string
  doc?: CardPostData
  relationTo: "articles"
  title?: string
}> = (props) => {
  const { className, doc, relationTo, title: titleFromProps } = props

  const { slug, meta, title } = doc || {}
  const { description, image } = meta || {}

  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, " ") // replace non-breaking space with white space
  const href = `/${relationTo}/${slug}`

  return (
    <HoverPrefetchLink href={href} className="block">
      <div className={cn("space-y-3", className)}>
        {image && typeof image !== "string" && (
          <Media
            media={image}
            variant="square"
            className="aspect-4/3 border object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 352px"
          />
        )}
        {titleToUse && <h3 className="hover:text-primary/80 md:text-2xl">{titleToUse}</h3>}
        {description && <p className="text-primary font-serif">{sanitizedDescription}</p>}
      </div>
    </HoverPrefetchLink>
  )
}
