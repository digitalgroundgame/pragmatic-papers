import React from "react"

import { AuthorAvatarStack } from "@/components/Authors/AuthorAvatarStack"
import { splitAuthors } from "@/components/Authors/splitAuthors"
import { ShareButtons } from "@/components/ShareButtons"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { Media } from "@/components/Media"
import { NarrationPlayer } from "@/components/NarrationPlayer"
import { Separator } from "@/components/ui/separator"
import type { Article, User } from "@/payload-types"
import { formatDateTime } from "@/utilities/formatDateTime"
import { getServerSideURL } from "@/utilities/getURL"
import { getSeparator } from "@/utilities/getSeparator"

interface ArticleHeroProps {
  article: Article
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({ article }) => {
  const { publishedAt, title, heroImage, authors, narration } = article

  const populatedAuthors = (authors || []).filter((a): a is User => typeof a === "object")
  // Same split as the avatar stack beside it, so the names and the faces
  // always agree on who got collapsed.
  const { visible: namedAuthors, overflow: overflowCount } = splitAuthors(populatedAuthors)
  // "N more" takes the final slot, so the separators — and the Oxford comma
  // that depends on which item is last — have to count it as one of them.
  const bylineLength = namedAuthors.length + (overflowCount > 0 ? 1 : 0)

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
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-8">
        <div className="flex flex-1 items-start justify-between gap-2 md:contents">
          <div className="dark:text-brand-high-contrast text-brand flex flex-1 flex-wrap items-center gap-2 font-serif font-bold underline-offset-4 md:order-1">
            <AuthorAvatarStack authors={populatedAuthors} />
            {namedAuthors.length > 0 && (
              <span>
                {namedAuthors.map(({ id, slug, name }, index) => (
                  <React.Fragment key={id}>
                    {getSeparator(index, bylineLength)}
                    <HoverPrefetchLink href={`/authors/${slug}`} className="hover:underline">
                      {name}
                    </HoverPrefetchLink>
                  </React.Fragment>
                ))}
                {overflowCount > 0 && (
                  <>
                    {getSeparator(namedAuthors.length, bylineLength)}
                    {`${overflowCount} more`}
                  </>
                )}
              </span>
            )}
            {"•"}
            {publishedAt && (
              <HoverPrefetchLink href={`/articles/${article.slug}`} className="hover:underline">
                <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
              </HoverPrefetchLink>
            )}
          </div>
          <ShareButtons
            url={`${getServerSideURL()}/articles/${article.slug}`}
            title={article.title}
            className="shrink-0 md:order-3"
          />
        </div>
        {narration && typeof narration !== "number" && (
          <div className="md:order-2 md:w-56 md:shrink-0">
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
      </div>
      <Separator />
    </div>
  )
}
