import React from "react"

import { Byline } from "@/components/Authors/Byline"
import { toBylineAuthor } from "@/components/Authors/BylineAuthor"
import { ShareButtons } from "@/components/ShareButtons"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { Separator } from "@/components/ui/separator"
import type { Article, User } from "@/payload-types"
import { formatDateTime } from "@/utilities/formatDateTime"
import { getServerSideURL } from "@/utilities/getURL"

interface ArticleHeroProps {
  article: Article
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({ article }) => {
  const { publishedAt, title, heroImage, authors, narration } = article

  const bylineAuthors = (authors || [])
    .filter((a): a is User => typeof a === "object")
    .map(toBylineAuthor)

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
      <div>
        <Byline authors={bylineAuthors} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          {publishedAt && (
            <HoverPrefetchLink
              href={`/articles/${article.slug}`}
              className="text-foreground font-serif font-bold underline-offset-4 hover:underline"
            >
              <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
            </HoverPrefetchLink>
          )}
          <div className="flex items-end justify-end gap-3">
            {narration && typeof narration !== "number" && (
              <div className="md:w-56 md:shrink-0">
                <NarrationPlayer
                  narration={narration}
                  narrator={
                    typeof narration.narrator === "object" && narration.narrator !== null
                      ? narration.narrator
                      : undefined
                  }
                />
              </div>
            )}
            <ShareButtons
              url={`${getServerSideURL()}/articles/${article.slug}`}
              title={article.title}
              className="shrink-0"
            />
          </div>
        </div>
      </div>
      <Separator />
    </div>
  )
}
