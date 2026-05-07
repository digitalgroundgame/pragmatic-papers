import type { Article, Media } from "@/payload-types"
import configPromise from "@payload-config"
import React from "react"
import { getPayload } from "payload"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { ImageMedia } from "@/components/Media/ImageMedia"

interface RecommendedArticlesProps {
  currentArticleSlug: string
}

const DISPLAY_COUNT = 4

export async function RecommendedArticles({
  currentArticleSlug,
}: RecommendedArticlesProps): Promise<React.ReactNode> {
  const payload = await getPayload({ config: configPromise })

  const recommendations = await payload.findGlobal({
    slug: "article-recommendations",
    depth: 2,
  })

  const rankings = recommendations?.rankings
  if (!rankings || rankings.length === 0) return null

  const articles = rankings
    .filter((r): r is typeof r & { article: Article } => typeof r.article === "object")
    .filter((r) => r.article.slug !== currentArticleSlug)
    .slice(0, DISPLAY_COUNT)
    .map((r) => {
      const article = r.article
      const metaImage = article.meta?.image
      return {
        slug: article.slug ?? "",
        title: article.title,
        metaImage:
          typeof metaImage === "object" && metaImage !== null ? (metaImage as Media) : null,
        metaDescription: article.meta?.description ?? null,
      }
    })

  if (articles.length === 0) return null

  return (
    <section className="mt-12 border-t pt-8" aria-label="Recommended articles">
      <h2 className="mb-4">Recommended</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {articles.map((article) => (
          <HoverPrefetchLink
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="group flex flex-col gap-2"
          >
            {article.metaImage && (
              <div className="aspect-video overflow-hidden rounded-sm border">
                <ImageMedia
                  media={article.metaImage}
                  variant="medium"
                  sizes="(min-width: 640px) 320px, 100vw"
                  className="h-full w-full object-cover object-center group-hover:opacity-80"
                />
              </div>
            )}
            <h3 className="text-primary group-hover:text-primary/80 font-display text-lg leading-none font-bold">
              {article.title}
            </h3>
            {article.metaDescription && (
              <p className="text-primary line-clamp-2 font-serif text-sm">
                {article.metaDescription}
              </p>
            )}
          </HoverPrefetchLink>
        ))}
      </div>
    </section>
  )
}
