import type { Article } from "@/payload-types"
import React from "react"

import { cardGroup, cardImageHover, cardTitleHover } from "@/components/cardHover"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media } from "@/components/Media"
import { docPath } from "@/utilities/routes"
import { cn } from "@/utilities/utils"

export type CardPostData = Pick<Article, "slug" | "meta" | "title">

export const ArticleCard: React.FC<{
  alignItems?: "center"
  className?: string
  doc?: CardPostData
  /** Preload the image at high priority, for a card that's above the fold. */
  preload?: boolean
  relationTo: "articles"
  title?: string
}> = (props) => {
  const { className, doc, preload, relationTo, title: titleFromProps } = props

  const { slug, meta, title } = doc || {}
  const { description, image } = meta || {}

  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, " ") // replace non-breaking space with white space
  const href = docPath(relationTo, slug ?? "")

  return (
    <HoverPrefetchLink href={href} className={cn(cardGroup, "block")}>
      <div className={cn("space-y-3", className)}>
        {image && typeof image !== "string" && (
          <Media
            media={image}
            variant="square"
            className={cn("aspect-4/3 border object-cover", cardImageHover)}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 352px"
            preload={preload}
          />
        )}
        {titleToUse && <h3 className={cn("md:text-2xl", cardTitleHover)}>{titleToUse}</h3>}
        {description && <p className="text-foreground font-serif">{sanitizedDescription}</p>}
      </div>
    </HoverPrefetchLink>
  )
}
