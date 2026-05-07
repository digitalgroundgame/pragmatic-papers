import type { Article, Media } from "@/payload-types"
import configPromise from "@payload-config"
import React from "react"
import { getPayload } from "payload"
import {
  RecommendedArticlesList,
  type RecommendedArticleCandidate,
} from "./RecommendedArticlesList"

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

  const candidates: RecommendedArticleCandidate[] = rankings
    .filter((r): r is typeof r & { article: Article } => typeof r.article === "object")
    .filter((r) => r.article.slug !== currentArticleSlug)
    .map((r) => {
      const article = r.article
      const metaImage = article.meta?.image
      return {
        slug: article.slug ?? "",
        title: article.title,
        metaImage:
          typeof metaImage === "object" && metaImage !== null ? (metaImage as Media) : null,
        metaDescription: article.meta?.description ?? null,
        engagementScore: r.engagementScore,
      }
    })

  if (candidates.length === 0) return null

  return <RecommendedArticlesList candidates={candidates} displayCount={DISPLAY_COUNT} />
}
