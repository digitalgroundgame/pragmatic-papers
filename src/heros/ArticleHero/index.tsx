import React from "react"

import { Byline } from "@/components/Authors/Byline"
import { toBylineAuthor } from "@/components/Authors/BylineAuthor"
import { ShareButtons } from "@/components/ShareButtons"
import { Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { Separator } from "@/components/ui/separator"
import type { Article, User } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { isResolved } from "@/utilities/relationships"
import { PublicationDates } from "./PublicationDates"

interface ArticleHeroProps {
  article: Article
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({ article }) => {
  const { publishedAt, updatedAt, title, heroImage, authors, narration } = article

  const bylineAuthors = (authors || []).filter(isResolved<User>).map(toBylineAuthor)

  return (
    <div className="relative flex flex-col gap-2 md:-mx-10 lg:-mx-32 xl:-mx-44">
      <Media
        priority
        sizes="(max-width: 768px) 100vw, 1024px"
        media={heroImage}
        variant="large"
        className="min-h-56 border object-cover shadow sm:min-h-85 md:min-h-[418px] lg:min-h-[570px]"
      />
      <h1 className="mt-3">{title}</h1>
      <Byline authors={bylineAuthors} />
      <div data-slot="article-meta" className="flex flex-wrap items-center gap-3">
        <div className="grow-999">
          <PublicationDates publishedAt={publishedAt} updatedAt={updatedAt} />
        </div>
        <div data-slot="article-meta-controls" className="flex grow items-center justify-end gap-3">
          <NarrationPlayer narration={narration} className="mr-auto shrink-0" />
          <ShareButtons
            url={`${getServerSideURL()}/articles/${article.slug}`}
            title={article.title}
          />
        </div>
      </div>
      <Separator />
    </div>
  )
}
