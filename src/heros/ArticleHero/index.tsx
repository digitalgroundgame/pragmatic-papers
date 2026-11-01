import React from "react"

import { CommentsLink } from "@/components/Comments/CommentsLink"
import { Byline } from "@/components/Authors/Byline"
import { toBylineAuthor } from "@/components/Authors/BylineAuthor"
import { ShareButtons } from "@/components/ShareButtons"
import { Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { TableOfContentsButton } from "@/components/TableOfContents"
import { Separator } from "@/components/ui/separator"
import type { Article, User } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"
import { isResolved } from "@/utilities/relationships"
import { PublicationDates } from "./PublicationDates"

interface ArticleHeroProps {
  article: Article
  /**
   * Whether to render the table of contents button. The page decides, since it
   * depends on the `tableOfContents` experiment as well as the article's own setting.
   */
  showTableOfContents?: boolean
  /** Whether to render the button that jumps to the comments, which the page renders only while comments are on. */
  showComments?: boolean
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({
  article,
  showTableOfContents = false,
  showComments = false,
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
        {/* The buttons sit edge to edge, so each icon's own padding spaces the row: 16px
            between every pair of glyphs. The player's `pr-2` gives "Listen" the same 16px
            before the next icon (its text has no padding of its own), and its `mr-auto`
            pushes it away from them when the row has room to spare. */}
        <div data-slot="article-meta-controls" className="flex grow items-center justify-end">
          <NarrationPlayer narration={narration} className="mr-auto shrink-0 pr-2" />
          {showTableOfContents && <TableOfContentsButton content={content} />}
          {showComments && <CommentsLink />}
          <ShareButtons url={`${getSiteURL()}/articles/${article.slug}`} title={article.title} />
        </div>
      </div>
      <Separator />
    </div>
  )
}
