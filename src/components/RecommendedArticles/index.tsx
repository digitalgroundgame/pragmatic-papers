"use client"

import type { RecommendedArticleCandidate } from "@/app/(frontend)/recommended-articles.json/route"
import React, { useEffect, useState } from "react"
import { HoverPrefetchLink } from "@/components/Link/HoverPrefetchLink"
import { ImageMedia } from "@/components/Media/ImageMedia"
import { Skeleton } from "@/components/ui/skeleton"
import { useInView } from "@/utilities/useInView"

interface RecommendedArticlesProps {
  currentArticleSlug: string
}

const DISPLAY_COUNT = 4

// Efraimidis–Spirakis weighted sampling without replacement: for each item,
// draw u ~ Uniform(0,1) and compute key = u^(1/w); take the top-k by key.
let cachedCandidates: RecommendedArticleCandidate[] | null = null
let inflightFetch: Promise<RecommendedArticleCandidate[]> | null = null

function getCandidates(): Promise<RecommendedArticleCandidate[]> {
  if (cachedCandidates) return Promise.resolve(cachedCandidates)
  if (inflightFetch) return inflightFetch
  inflightFetch = fetch("/recommended-articles.json", {
    cache: "no-store",
    priority: "low",
  } as RequestInit)
    .then((r) => r.json() as Promise<{ candidates: RecommendedArticleCandidate[] }>)
    .then(({ candidates }) => {
      cachedCandidates = candidates
      inflightFetch = null
      return candidates
    })
    .catch((e) => {
      inflightFetch = null
      throw e
    })
  return inflightFetch
}

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
    getCandidates()
      .then((candidates) => {
        if (cancelled) return
        const filtered = candidates.filter((c) => c.slug !== currentArticleSlug)
        setSampled(weightedSampleWithoutReplacement(filtered, DISPLAY_COUNT))
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
    <section ref={sectionRef} className="mt-12 border-t pt-8" aria-label="Recommended articles">
      <h2 className="text-muted-foreground mb-4 font-sans text-xs font-bold tracking-wider uppercase">
        Recommended
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {sampled === null
          ? Array.from({ length: DISPLAY_COUNT }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2" aria-hidden>
                <Skeleton className="aspect-video w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))
          : sampled.map((article) => (
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
