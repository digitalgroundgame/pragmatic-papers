"use client"

import type { Media } from "@/payload-types"
import React, { useEffect, useState } from "react"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { ImageMedia } from "@/components/Media/ImageMedia"

export interface RecommendedArticleCandidate {
  slug: string
  title: string
  metaImage: Media | null
  metaDescription: string | null
  engagementScore: number
}

interface RecommendedArticlesListProps {
  candidates: RecommendedArticleCandidate[]
  displayCount: number
}

// Efraimidis–Spirakis weighted sampling without replacement: for each item,
// draw u ~ Uniform(0,1) and compute key = u^(1/w); take the top-k by key.
function weightedSampleWithoutReplacement<T extends { engagementScore: number }>(
  items: T[],
  k: number,
): T[] {
  return items
    .map((item) => ({
      item,
      key: Math.pow(Math.random(), 1 / Math.max(item.engagementScore, 1e-9)),
    }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map(({ item }) => item)
}

export function RecommendedArticlesList({
  candidates,
  displayCount,
}: RecommendedArticlesListProps): React.ReactNode {
  const [sampled, setSampled] = useState<RecommendedArticleCandidate[] | null>(null)

  useEffect(() => {
    setSampled(weightedSampleWithoutReplacement(candidates, displayCount))
  }, [candidates, displayCount])

  if (!sampled || sampled.length === 0) return null

  return (
    <section className="mt-12 border-t pt-8" aria-label="Recommended articles">
      <h2 className="text-muted-foreground mb-4 font-sans text-xs font-bold tracking-wider uppercase">
        Recommended
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {sampled.map((article) => (
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
