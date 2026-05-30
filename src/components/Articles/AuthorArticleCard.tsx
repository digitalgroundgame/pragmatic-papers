import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media } from "@/components/Media"
import { Card, CardContent } from "@/components/ui/card"
import type { Article, Volume } from "@/payload-types"
import { cn } from "@/utilities/utils"

export interface AuthorArticleCardProps {
  article: Article
  volume?: Volume
  className?: string
}

export const AuthorArticleCard: React.FC<AuthorArticleCardProps> = ({
  article,
  volume,
  className,
}) => {
  const { slug, meta, title } = article
  const { description, image: metaImage } = meta || {}

  const href = `/articles/${slug}`

  return (
    <Card className={cn("rounded-sm", className)}>
      <CardContent className="flex flex-col items-center gap-4 md:flex-row">
        <div className="bg-muted shrink-0 overflow-hidden rounded-sm border md:h-24 md:w-32">
          {metaImage && typeof metaImage !== "string" && (
            <HoverPrefetchLink href={href} className="hover:opacity-50">
              <Media
                media={metaImage}
                className="aspect-3/2 object-cover md:aspect-4/3"
                variant="thumbnail"
                sizes="(max-width: 640px) 128px, 160px"
              />
            </HoverPrefetchLink>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {title && (
            <h3 className="text-primary hover:text-primary/80 line-clamp-3 text-pretty md:text-2xl">
              <HoverPrefetchLink href={href}>{title}</HoverPrefetchLink>
            </h3>
          )}
          {description && (
            <p className="text-primary line-clamp-2 font-serif text-sm">{description}</p>
          )}
          {volume && (
            <HoverPrefetchLink
              href={`/volumes/${volume.slug}`}
              className="text-muted-foreground mt-auto line-clamp-1 text-sm underline-offset-2 hover:underline"
            >
              {volume.title ?? volume.slug}
            </HoverPrefetchLink>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
