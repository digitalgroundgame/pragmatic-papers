import React from "react"

import { CommentsLink } from "@/components/Comments/CommentsLink"
import { Byline } from "@/components/Authors/Byline"
import { toBylineAuthor } from "@/components/Authors/BylineAuthor"
import { ReadOnSubstack } from "@/components/ReadOnSubstack"
import { ShareButtons } from "@/components/ShareButtons"
import { Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { TableOfContentsButton } from "@/components/TableOfContents"
import { Separator } from "@/components/ui/separator"
import type { Article, User } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"
import { isResolved } from "@/utilities/relationships"
import { heroAspectRatio } from "./heroAspectRatio"
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
  const { publishedAt, contentUpdatedAt, title, heroImage, authors, narration, content } = article

  const bylineAuthors = (authors || []).filter(isResolved<User>).map(toBylineAuthor)

  return (
    <div className="relative flex flex-col gap-2">
      <Media
        preload
        sizes="(max-width: 768px) 100vw, 1024px"
        media={heroImage}
        variant="large"
        // The image keeps its own shape within limits (`heroAspectRatio`), so a wide banner
        // isn't zoomed in and cut off at the sides; outside them it's cropped around its
        // focal point.
        style={{ aspectRatio: heroAspectRatio(heroImage) }}
        className="w-full border object-cover shadow"
      />
      <h1 className="mt-3">{title}</h1>
      <Byline authors={bylineAuthors} />
      <div data-slot="article-meta" className="flex flex-wrap items-center gap-3">
        <div className="grow-999">
          <PublicationDates publishedAt={publishedAt} updatedAt={contentUpdatedAt} />
        </div>
        {/* The buttons sit edge to edge, so each icon's own padding spaces the row: 16px
            between every pair of glyphs. The collapsed player's "Listen" label carries the
            same 16px on its right, and `mr-auto` pushes the player away from the buttons
            when the row has room to spare. */}
        <div data-slot="article-meta-controls" className="flex grow items-center justify-end">
          <NarrationPlayer narration={narration} className="mr-auto shrink-0" />
          {showTableOfContents && <TableOfContentsButton content={content} />}
          {showComments && <CommentsLink />}
          <ReadOnSubstack article={article} variant="icon" />
          <ShareButtons url={`${getSiteURL()}/articles/${article.slug}`} title={article.title} />
        </div>
      </div>
      <Separator />
    </div>
  )
}
