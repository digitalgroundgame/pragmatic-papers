import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"
import { generateMeta } from "@/utilities/generateMeta"
import { queryArticleBySlug } from "@/data/queries"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import React from "react"
import { FeedShell } from "../../FeedShell"
import { getFeedBatch, withVolumes } from "../../getFeedBatch"
import { renderFeedArticle } from "../../renderFeedArticle"
import type { FeedArticle } from "../../types"

const feedMetadata: Metadata = {
  title: "Feed · Pragmatic Papers",
  description: "Swipe through the latest from Pragmatic Papers.",
  robots: { index: false, follow: true },
}

export const dynamic = "force-dynamic"
export const revalidate = 0

interface DeepLinkFeedPageProps {
  params: Promise<{ collection: string; slug: string }>
  searchParams: Promise<{ p?: string }>
}

/**
 * A deep link is the article in another view, so it takes the article's title,
 * description and share image, with the article page as its canonical URL.
 * Anything the page would 404 on keeps the feed's own, unindexed metadata.
 */
export async function generateMetadata({ params }: DeepLinkFeedPageProps): Promise<Metadata> {
  const { collection, slug } = await params
  if (collection !== "articles" || !(await isExperimentEnabled("feed"))) return feedMetadata

  const article = await queryArticleBySlug(slug)
  if (!article) return feedMetadata

  return generateMeta({ doc: article, canonicalPath: `/articles/${slug}` })
}

export default async function DeepLinkFeedPage({
  params,
  searchParams,
}: DeepLinkFeedPageProps): Promise<React.ReactNode> {
  const { collection, slug } = await params
  const { p } = await searchParams

  if (collection !== "articles") return notFound()
  if (!(await isExperimentEnabled("feed"))) return notFound()

  const article = await queryArticleBySlug(slug)
  if (!article) return notFound()

  const [target] = (await withVolumes([article])) as [FeedArticle]

  const batch = await getFeedBatch({ cursor: 1 })
  const filtered = batch.items.filter((a) => a.id !== target.id)
  const fromBatch = batch.items.find((a) => a.id === target.id)
  const items: FeedArticle[] = [fromBatch ?? target, ...filtered]

  const parsed = p ? Number.parseInt(p, 10) : NaN
  const initialPageIndex = Number.isFinite(parsed) && parsed > 0 ? parsed : 0

  return (
    <FeedShell
      initialItems={items.map(renderFeedArticle)}
      initialNextCursor={batch.nextCursor}
      initialPinnedArticleId={target.id}
      initialPageIndex={initialPageIndex}
    />
  )
}
