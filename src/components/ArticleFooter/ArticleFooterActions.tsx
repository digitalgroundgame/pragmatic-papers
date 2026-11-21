import React from "react"

import { ReadOnSubstack } from "@/components/ReadOnSubstack"
import { ShareButtons } from "@/components/ShareButtons"
import type { Article } from "@/payload-types"
import { getSiteURL } from "@/utilities/getURL"
import { cn } from "@/utilities/utils"

export interface ArticleFooterActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  article: Pick<Article, "slug" | "title" | "syndicateToSubstack" | "substackUrl">
}

/**
 * What a reader can do once they've finished the article: read it on Substack, when it's
 * there, and share it. The actions bar under the title offers the same two. It closes the
 * topics' section of the footer.
 */
export const ArticleFooterActions: React.FC<ArticleFooterActionsProps> = ({
  article,
  className,
  ...props
}) => (
  <div
    data-slot="article-footer-actions"
    className={cn("flex items-center gap-2", className)}
    {...props}
  >
    <ReadOnSubstack article={article} />
    <ShareButtons
      url={`${getSiteURL()}/articles/${article.slug}`}
      title={article.title}
      showLabel
    />
  </div>
)
