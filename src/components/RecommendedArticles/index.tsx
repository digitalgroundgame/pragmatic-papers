import type { Article } from "@/payload-types"
import configPromise from "@payload-config"
import { getPayload } from "payload"
import React from "react"

import { Media } from "@/components/Media"
import { TimeAgo } from "@/components/TimeAgo"

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
    .map((r) => r.article)
    .filter((r): r is Article => typeof r === "object")
    .filter((r) => r.slug !== currentArticleSlug)
    .slice(0, DISPLAY_COUNT)

  if (articles.length === 0) return null

  return (
    <section className="container mt-12 max-w-3xl border-t pt-8" aria-label="Recommended articles">
      <h2 className="mb-4">Recommended</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {articles.map((article) => (
          <a
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="group flex flex-row gap-x-4 gap-y-2 md:flex-col"
          >
            {article.meta?.image && (
              <div className="aspect-square size-24 rounded-sm border md:aspect-video md:size-auto">
                <Media
                  media={article.meta.image}
                  variant="medium"
                  sizes="(min-width: 640px) 320px, 100vw"
                  className="h-full w-full object-cover object-center group-hover:opacity-80"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <h3 className="text-primary group-hover:text-primary/80 md:text-2xl">
                {article.title}
              </h3>
              {article.meta?.description && (
                <p className="text-primary line-clamp-2 hidden font-serif text-sm md:block">
                  {article.meta.description}
                </p>
              )}
              <TimeAgo publishedAt={article.publishedAt} />
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
