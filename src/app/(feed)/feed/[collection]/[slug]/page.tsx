import { queryArticleBySlug } from "@/utilities/queries"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import React from "react"
import { FeedShell } from "../../FeedShell"
import { getFeedBatch } from "../../getFeedBatch"
import type { FeedArticle } from "../../types"

export const metadata: Metadata = {
  title: "Feed · Pragmatic Papers",
  description: "Swipe through the latest from Pragmatic Papers.",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

interface DeepLinkFeedPageProps {
  params: Promise<{ collection: string; slug: string }>
  searchParams: Promise<{ p?: string }>
}

export default async function DeepLinkFeedPage({
  params,
  searchParams,
}: DeepLinkFeedPageProps): Promise<React.ReactNode> {
  const { collection, slug } = await params
  const { p } = await searchParams

  if (collection !== "articles") return notFound()

  const article = await queryArticleBySlug(slug)
  if (!article) return notFound()

  const target = article as unknown as FeedArticle

  const batch = await getFeedBatch({ cursor: 1 })
  const filtered = batch.items.filter((a) => a.id !== target.id)
  const fromBatch = batch.items.find((a) => a.id === target.id)
  const items: FeedArticle[] = [fromBatch ?? target, ...filtered]

  const parsed = p ? Number.parseInt(p, 10) : NaN
  const initialPageIndex = Number.isFinite(parsed) && parsed > 0 ? parsed : 0

  return (
    <FeedShell
      initialItems={items}
      initialNextCursor={batch.nextCursor}
      initialPinnedArticleId={target.id}
      initialPageIndex={initialPageIndex}
    />
  )
}
