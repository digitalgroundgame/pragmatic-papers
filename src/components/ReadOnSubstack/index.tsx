import React from "react"

import { substackPostUrl } from "@/collections/Articles/substackUrl"
import { SubstackIcon } from "@/components/SocialLinks/icons"
import { buttonVariants } from "@/components/ui/button"
import type { Article } from "@/payload-types"
import { cn } from "@/utilities/utils"

export interface ReadOnSubstackProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> {
  article: Pick<Article, "syndicateToSubstack" | "substackUrl">
}

/**
 * An icon button in the article's actions bar that opens the article's post on Substack,
 * once an editor has recorded where it landed.
 */
export const ReadOnSubstack: React.FC<ReadOnSubstackProps> = ({ article, className, ...props }) => {
  const href = substackPostUrl(article)
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Read on Substack"
      title="Read on Substack"
      data-slot="button"
      className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "shrink-0", className)}
      {...props}
    >
      <SubstackIcon />
    </a>
  )
}
