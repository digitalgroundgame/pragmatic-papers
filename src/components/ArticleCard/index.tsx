import type { Article } from "@/payload-types"
import React from "react"

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
    <HoverPrefetchLink href={href} className="group block">
      <div className={cn("space-y-3", className)}>
        {image && typeof image !== "string" && (
          <Media
            media={image}
            variant="square"
            className="aspect-4/3 border object-cover transition-[filter] duration-300 ease-out hover:brightness-[1.02] hover:contrast-[1.16] hover:saturate-[1.16]"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 352px"
            preload={preload}
          />
        )}
        {titleToUse && (
          <h3 className="decoration-2 underline-offset-4 group-focus-visible:underline hover:underline md:text-2xl">
            {titleToUse}
          </h3>
        )}
        {description && <p className="text-foreground font-serif">{sanitizedDescription}</p>}
      </div>
    </HoverPrefetchLink>
  )
}
