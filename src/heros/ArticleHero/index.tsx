import React from "react"

import { ShareButtons } from "@/components/ShareButtons"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { isAudioMedia, Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { Separator } from "@/components/ui/separator"
import type { Article, User } from "@/payload-types"
import { formatDateTime } from "@/utilities/formatDateTime"
import { getServerSideURL } from "@/utilities/getURL"
import { getSeparator } from "@/utilities/getSeparator"
import { isResolved } from "@/utilities/relationships"

interface ArticleHeroProps {
  article: Article
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({ article }) => {
  const { publishedAt, title, heroImage, authors, narration } = article

  const populatedAuthors = (authors || []).filter(isResolved<User>)

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
      {/* The narration player sits between the byline and the share buttons in the
          DOM so keyboard focus reaches it in the order it is read on md and up.
          Below md it wraps onto its own line via `order`. */}
      <div className="flex flex-wrap items-start gap-2 md:flex-nowrap md:items-center md:gap-8">
        <div className="dark:text-brand-high-contrast text-brand order-1 flex flex-1 flex-wrap gap-2 font-serif font-bold underline-offset-4">
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
        {isAudioMedia(narration) && (
          <div className="order-3 w-full md:order-2 md:w-56 md:shrink-0">
            <NarrationPlayer narration={narration} />
          </div>
        )}
        <ShareButtons
          url={`${getServerSideURL()}/articles/${article.slug}`}
          title={article.title}
          className="order-2 shrink-0 md:order-3"
        />
      </div>
      <Separator />
    </div>
  )
}
