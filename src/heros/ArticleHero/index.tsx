import React from "react"

import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { Separator } from "@/components/ui/separator"
import type { Article } from "@/payload-types"
import { formatDateTime } from "@/utilities/formatDateTime"
import { getSeparator } from "@/utilities/getSeparator"

interface ArticleHeroProps {
  article: Article
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({ article }) => {
  const { publishedAt, title, heroImage, populatedAuthors, narration, populatedNarrator } = article

  return (
    <div className="relative flex flex-col gap-2 md:-mx-10 lg:-mx-32 xl:-mx-44">
      {heroImage && (
        <Media
          priority
          sizes="(max-width: 768px) 100vw, 1024px"
          media={heroImage}
          variant="large"
          className="min-h-56 border object-cover shadow sm:min-h-85 md:min-h-[418px] lg:min-h-[570px]"
        />
      )}
      <h1 className="mt-6">{title}</h1>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-8">
        <div className="dark:text-brand-high-contrast text-brand flex flex-1 gap-2 font-serif font-bold underline-offset-4">
          {populatedAuthors &&
            populatedAuthors.map(({ id, slug, name }, index) => (
              <React.Fragment key={id}>
                {getSeparator(index, populatedAuthors.length)}
                <HoverPrefetchLink href={`/authors/${slug}`} className="hover:underline">
                  {name}
                </HoverPrefetchLink>
              </React.Fragment>
            ))}
          {"•"}
          {publishedAt && (
            <HoverPrefetchLink href={`/articles/${article.slug}`} className="hover:underline">
              <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
            </HoverPrefetchLink>
          )}
        </div>
        {narration && typeof narration !== "number" && (
          <div className="md:w-56 md:shrink-0">
            <NarrationPlayer narration={narration} populatedNarrator={populatedNarrator} />
          </div>
        )}
      </div>
      <Separator />
    </div>
  )
}
