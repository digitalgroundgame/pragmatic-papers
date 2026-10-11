import React from "react"

import { Byline } from "@/components/Authors/Byline"
import { toBylineAuthor } from "@/components/Authors/BylineAuthor"
import { ShareButtons } from "@/components/ShareButtons"
import { Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { TableOfContentsButton } from "@/components/TableOfContents"
import { Separator } from "@/components/ui/separator"
import type { Article, User } from "@/payload-types"
import { getServerSideURL } from "@/utilities/getURL"
import { isResolved } from "@/utilities/relationships"
import { PublicationDates } from "./PublicationDates"

interface ArticleHeroProps {
  article: Article
  /**
   * Whether to render the table of contents button. The page decides, since it
   * depends on the `tableOfContents` experiment as well as the article's own setting.
   */
  showTableOfContents?: boolean
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({
  article,
  showTableOfContents = false,
}) => {
  const { publishedAt, updatedAt, title, heroImage, authors, narration, content } = article

  const bylineAuthors = (authors || []).filter(isResolved<User>).map(toBylineAuthor)

  return (
    <div className="relative flex flex-col gap-2">
      <Media
        preload
        sizes="(max-width: 768px) 100vw, 1024px"
        media={heroImage}
        variant="large"
        className="min-h-56 border object-cover shadow sm:min-h-85 md:min-h-104.5 lg:min-h-142.5"
      />
      <h1 className="mt-3">{title}</h1>
      <Byline authors={bylineAuthors} />
      <div data-slot="article-meta" className="flex flex-wrap items-center gap-3">
        <div className="grow-999">
          <PublicationDates publishedAt={publishedAt} updatedAt={updatedAt} />
        </div>
        <div data-slot="article-meta-controls" className="flex grow items-center justify-end gap-1">
          <NarrationPlayer narration={narration} className="mr-auto shrink-0" />
          {showTableOfContents && <TableOfContentsButton content={content} />}
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
