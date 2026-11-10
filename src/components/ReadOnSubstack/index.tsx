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
  /**
   * `icon` is the icon button in the article's actions bar; `button` (the default) is the
   * labelled button under the article.
   */
  variant?: "button" | "icon"
}

/**
 * A link to the article's post on Substack, once an editor has recorded where it landed.
 * An article shows it twice: as an icon in its actions bar and as a button at its end.
 */
export const ReadOnSubstack: React.FC<ReadOnSubstackProps> = ({
  article,
  variant = "button",
  className,
  ...props
}) => {
  const href = substackPostUrl(article)
  if (!href) return null

  if (variant === "icon") {
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

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-slot="button"
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), className)}
      {...props}
    >
      <SubstackIcon className="text-[#ff6719]" />
      Read on Substack
    </a>
  )
}
