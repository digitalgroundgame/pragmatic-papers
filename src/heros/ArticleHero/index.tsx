import React from "react"

import { ShareButtons } from "@/components/ShareButtons"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { TableOfContentsButton } from "@/components/TableOfContents"
import { Separator } from "@/components/ui/separator"
import type { Article } from "@/payload-types"
import { formatDateTime } from "@/utilities/formatDateTime"
import { getServerSideURL } from "@/utilities/getURL"
import { getSeparator } from "@/utilities/getSeparator"

interface ArticleHeroProps {
  article: Article
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({ article }) => {
  const {
    publishedAt,
    title,
    heroImage,
    populatedAuthors,
    narration,
    populatedNarrator,
    showTableOfContents,
  } = article

  return (
    <div className="relative flex flex-col gap-2">
      {heroImage && (
        <Media
          priority
          sizes="(max-width: 768px) 100vw, 1024px"
          media={heroImage}
          variant="large"
          className="min-h-56 border object-cover shadow sm:min-h-85 md:min-h-104.5 lg:min-h-142.5"
        />
      )}
      <h1 className="mt-6">{title}</h1>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <div className="dark:text-brand-high-contrast text-brand flex grow basis-64 flex-wrap gap-2 font-serif font-bold underline-offset-4">
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
        {showTableOfContents && <TableOfContentsButton />}
        <ShareButtons
          url={`${getServerSideURL()}/articles/${article.slug}`}
          title={article.title}
          className="shrink-0"
        />
      </div>
      <Separator />
    </div>
  )
}
