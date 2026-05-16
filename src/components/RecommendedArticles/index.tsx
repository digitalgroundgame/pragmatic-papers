"use client"

import type { RecommendedArticleCandidate } from "@/app/(frontend)/recommended-articles.json/route"
import { sendGAEvent } from "@next/third-parties/google"
import React, { useEffect, useState } from "react"
import { Media } from "@/components/Media"
import { Skeleton } from "@/components/ui/skeleton"
import { TimeAgo } from "@/components/TimeAgo"
import { useInView } from "@/utilities/useInView"

interface RecommendedArticlesProps {
  currentArticleSlug: string
}

const DISPLAY_COUNT = 4

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

export function RecommendedArticles({
  currentArticleSlug,
}: RecommendedArticlesProps): React.ReactNode {
  // Defer fetch until the section approaches the viewport so we don't compete
  // with LCP resources during initial page load.
  const { ref: sectionRef, inView } = useInView<HTMLElement>({ rootMargin: "300px" })
  const [sampled, setSampled] = useState<RecommendedArticleCandidate[] | null>(null)

  useEffect(() => {
    if (!inView) return
    let cancelled = false
    fetch("/recommended-articles.json", {
      cache: "no-store",
      priority: "low",
    } as RequestInit)
      .then((r) => r.json() as Promise<{ candidates: RecommendedArticleCandidate[] }>)
      .then(({ candidates }) => {
        if (cancelled) return
        const filtered = candidates.filter((c) => c.slug !== currentArticleSlug)
        const picks = weightedSampleWithoutReplacement(filtered, DISPLAY_COUNT)
        setSampled(picks)
        if (picks.length > 0) {
          sendGAEvent("event", "recommended_section_view", {
            source_slug: currentArticleSlug,
            count: picks.length,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setSampled([])
      })
    return () => {
      cancelled = true
    }
  }, [inView, currentArticleSlug])

  if (sampled && sampled.length === 0) return null

  return (
    <section
      ref={sectionRef}
      className="container mt-12 max-w-3xl border-t pt-8"
      aria-label="Recommended articles"
    >
      <h2 className="mb-4">Recommended</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {sampled === null
          ? Array.from({ length: DISPLAY_COUNT }).map((_, i) => (
              <div key={i} className="flex flex-row gap-x-4 gap-y-2 md:flex-col" aria-hidden>
                <Skeleton className="aspect-square size-24 min-w-24 rounded-sm md:aspect-video md:size-auto md:w-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="hidden h-5 w-full md:block" />
                  <Skeleton className="hidden h-5 w-5/6 md:block" />
                  <Skeleton className="mt-1 h-4 w-20" />
                </div>
              </div>
            ))
          : sampled.map((article, index) => (
              <a
                key={article.slug}
                href={`/articles/${article.slug}`}
                className="group flex flex-row gap-x-4 gap-y-2 md:flex-col"
                onClick={() => {
                  sendGAEvent("event", "recommended_article_click", {
                    source_slug: currentArticleSlug,
                    target_slug: article.slug,
                    position: index + 1,
                  })
                }}
              >
                {article.metaImage && (
                  <div className="aspect-square size-24 min-w-24 overflow-hidden rounded-sm border md:aspect-video md:size-auto">
                    <Media
                      media={article.metaImage}
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
                  {article.metaDescription && (
                    <p className="text-primary line-clamp-2 hidden font-serif text-sm md:block">
                      {article.metaDescription}
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
